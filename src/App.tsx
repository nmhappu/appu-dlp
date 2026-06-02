import React, { useState, useEffect, useCallback, FormEvent, useRef } from 'react';
import { 
  Download, 
  Search, 
  Globe, 
  HardDrive, 
  Video, 
  Music, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  ExternalLink,
  RefreshCw,
  FolderOpen,
  X,
  Key,
  Settings,
  ShieldAlert
} from 'lucide-react';
import { VideoInfo, DownloadJob } from './types';
import { APP_COLORS } from './colors';

export default function App() {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedVideo, setAnalyzedVideo] = useState<VideoInfo | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [notif, setNotif] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showCookies, setShowCookies] = useState(false);
  const [cookiesContent, setCookiesContent] = useState('');
  const [cookiesLoaded, setCookiesLoaded] = useState(false);

  const [downloadTarget, setDownloadTarget] = useState<'server' | 'browser'>('browser');
  const [engine, setEngine] = useState<'yt-dlp' | 'curl'>('yt-dlp');
  const autoDownloadedRef = useRef<Set<string>>(new Set());

  // Load if cookies exist on the server
  const checkCookies = useCallback(async () => {
    try {
      const res = await fetch('/api/cookies');
      if (res.ok) {
        const data = await res.json();
        setCookiesLoaded(data.exists);
      }
    } catch (err) {}
  }, []);

  useEffect(() => {
    checkCookies();
  }, [checkCookies]);

  const handleSaveCookies = async (cookiesTextToSave?: string) => {
    const textToSave = cookiesTextToSave !== undefined ? cookiesTextToSave : cookiesContent;
    try {
      const res = await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: textToSave })
      });
      if (res.ok) {
        setCookiesLoaded(textToSave.trim().length > 0);
        triggerNotification('success', textToSave.trim().length > 0 ? 'Session cookies configured successfully.' : 'Cookies cleared.');
        setCookiesContent('');
        setShowCookies(false);
      } else {
        throw new Error('Failed to update session cookies on the server.');
      }
    } catch (err: any) {
      triggerNotification('error', err.message || 'An error occurred updating cookies.');
    }
  };

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notif) {
      const timer = setTimeout(() => setNotif(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notif]);

  // Handle errors or success alerts cleanly
  const triggerNotification = (type: 'success' | 'error', message: string) => {
    setNotif({ type, message });
  };

  // Fetch all background transfer jobs
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data: DownloadJob[] = await res.json();
        setJobs(data);

        // Auto trigger download for completed browser targets
        data.forEach((job) => {
          if (job.status === 'completed' && job.downloadTarget === 'browser') {
            if (!autoDownloadedRef.current.has(job.id)) {
              autoDownloadedRef.current.add(job.id);
              
              // Programmatically click browser download link
              const link = document.createElement('a');
              link.href = `/api/download/${job.id}`;
              link.download = '';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              setNotif({
                type: 'success',
                message: `Successfully popped download for "${job.title}" into browser!`
              });
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch transfer jobs:', err);
    }
  }, []);

  // Setup periodic background polling loops
  useEffect(() => {
    fetchJobs();

    const jobsInterval = setInterval(fetchJobs, 1500); // Poll fast for realistic speed monitoring

    return () => {
      clearInterval(jobsInterval);
    };
  }, [fetchJobs]);

  // Inspect the submitted URL to fetch available streaming formats
  const handleInspect = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setAnalyzing(true);
    setAnalyzedVideo(null);
    setCustomFilename('');

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), engine })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server rejected URL analysis request.');
      }

      const data: VideoInfo = await res.json();
      setAnalyzedVideo(data);
      setCustomFilename(data.title);

      // Select default format: attempt to pre-select matching video+audio combination, or fall back to generic/first format
      if (data.formats && data.formats.length > 0) {
        const defaultFormat = data.formats.find(f => f.hasVideo && f.hasAudio) || data.formats[0];
        setSelectedFormatId(defaultFormat.formatId);
      } else {
        setSelectedFormatId('best');
      }

      triggerNotification('success', 'Media streams analyzed successfully.');
    } catch (err: any) {
      console.error(err);
      triggerNotification('error', err.message || 'Failure loading stream metadata. Please check the network address.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Dispatch format-specific host download run
  const handleInitiateDownload = async () => {
    if (!url.trim()) return;

    try {
      const payload = {
        url: url.trim(),
        formatId: selectedFormatId,
        title: customFilename.trim() || (analyzedVideo ? analyzedVideo.title : 'Stream Download'),
        thumbnail: analyzedVideo?.thumbnail || '',
        downloadTarget,
        engine
      };

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to submit download transfer.');
      }

      const modeText = downloadTarget === 'browser' ? 'Will auto-save to browser!' : 'Saved to Server storage.';
      triggerNotification('success', `Transfer job enqueued. ${modeText}`);
      setAnalyzedVideo(null);
      setUrl('');
      
      // Refresh current records immediately
      fetchJobs();
    } catch (err: any) {
      triggerNotification('error', err.message || 'An error occurred triggering server download.');
    }
  };

  // Wipe download task logs + caches
  const handleDeleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== jobId));
        triggerNotification('success', 'Transfer log or cache cleared safely.');
      }
    } catch (err) {
      triggerNotification('error', 'Could not purge target job record.');
    }
  };

  // Auto-set pre-filled testing inputs
  const loadPresetLink = (presetUrl: string) => {
    setUrl(presetUrl);
    setAnalyzedVideo(null);
  };

  // Helper: Format filesize in bytes to human-readable strings
  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown Size';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return (mb / 1024).toFixed(1) + ' GB';
    }
    return mb.toFixed(1) + ' MB';
  };

  // Helper: Get human duration
  const formatDuration = (sec: number | null) => {
    if (sec === null) return 'N/A';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      style={{ backgroundColor: APP_COLORS.bgPrimary, color: APP_COLORS.textNormal }}
      className="min-h-screen font-sans flex flex-col antialiased selection:bg-sky-500/30 selection:text-white"
    >
      
      {/* Floating System Notification */}
      {notif && (
        <div 
          style={{ 
            zIndex: 9999,
            backgroundColor: notif.type === 'success' ? APP_COLORS.successBg : APP_COLORS.failedBg,
            borderColor: notif.type === 'success' ? `${APP_COLORS.successAccent}30` : `${APP_COLORS.failedAccent}30`,
            color: notif.type === 'success' ? APP_COLORS.successAccent : APP_COLORS.failedAccent
          }}
          className="fixed top-6 right-6 flex items-center gap-3 px-5 py-4 rounded-md border shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4"
        >
          {notif.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <div className="text-sm font-medium pr-4">{notif.message}</div>
          <button onClick={() => setNotif(null)} className="hover:opacity-70">
            <X className="w-4 h-4 cursor-pointer" />
          </button>
        </div>
      )}

      {/* Top Header Navigation */}
      <nav 
        style={{ backgroundColor: APP_COLORS.bgHeader }}
        className="h-16 border-b border-slate-800/60 px-6 md:px-8 flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-3">
          <div 
            style={{ 
              borderColor: `${APP_COLORS.skyAccent}30`,
              background: `linear-gradient(135deg, ${APP_COLORS.bgSecondary} 0%, ${APP_COLORS.bgHeader} 100%)`
            }}
            className="w-10 h-10 rounded-md flex items-center justify-center border shadow-lg relative group overflow-hidden"
          >
            {/* Ambient background glow inside the icon */}
            <div className="absolute inset-0 bg-sky-500/10 opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
            {/* Custom crafted SVG combining Download Arrow + Network Node Plexus layout */}
            <svg className="w-5 h-5 text-sky-400 relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3V16M12 16L7 11M12 16L17 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 20H4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-white flex items-center">
              appu-dlp
              <span style={{ color: APP_COLORS.skyGlow }} className="text-xs font-mono font-bold ml-1.5 uppercase">
                v2.4
              </span>
            </span>
          </div>
        </div>
      </nav>

      {/* Main Container Section */}
      <main className="flex-1 max-w-[1000px] w-full mx-auto flex flex-col p-4 md:p-8 gap-6 md:gap-8 min-h-0">
        
        {/* New Download Link Form Section */}
        <section className="bg-[#141720] rounded-lg p-6 md:p-8 border border-slate-800/80 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-xs uppercase tracking-[0.25em] text-slate-500 font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              Download File
            </h2>
            
            {/* Toggler on the opposite side */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <div className="flex items-center bg-[#090A0D] p-0.5 rounded border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setEngine('yt-dlp');
                    setAnalyzedVideo(null);
                  }}
                  className={`px-2.5 py-1 text-[10px] uppercase font-sans font-extrabold tracking-wider rounded-sm transition-all cursor-pointer ${
                    engine === 'yt-dlp'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  yt-dlp
                </button>
                <span className="text-slate-700 px-1 text-[10px] font-medium pointer-events-none select-none">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setEngine('curl');
                    setAnalyzedVideo(null);
                  }}
                  className={`px-2.5 py-1 text-[10px] uppercase font-sans font-extrabold tracking-wider rounded-sm transition-all cursor-pointer ${
                    engine === 'curl'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  curl
                </button>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleInspect} className="flex flex-col md:flex-row gap-4 mt-1">
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste media or file link here..." 
                className="w-full bg-[#0A0B0E] border border-slate-800 focus:border-sky-500/80 rounded-md pl-5 pr-12 py-4 focus:outline-none text-slate-100 placeholder-slate-600 transition-all font-sans text-sm shadow-inner"
              />
              <div className="absolute right-4 top-4 text-slate-600">
                <Search className="w-5 h-5" />
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={analyzing || !url.trim()}
              className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold px-8 py-4 rounded-md transition-all cursor-pointer shadow-lg shadow-sky-950/20 active:scale-98 flex items-center justify-center gap-3 shrink-0"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  FETCHING...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Fetch
                </>
              )}
            </button>
          </form>

          {/* Preset Helper Links for rapid user verification */}
          <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <button 
                type="button"
                onClick={() => loadPresetLink('https://www.youtube.com/watch?v=aqz-KE-bpKQ')}
                className="px-2.5 py-1 text-[11px] bg-sky-500/5 hover:bg-sky-500/15 border border-sky-500/10 text-sky-400 rounded transition-colors font-sans cursor-pointer"
              >
                YouTube Big Buck Bunny
              </button>
              <button 
                type="button"
                onClick={() => loadPresetLink('https://www.reddit.com/r/pics/comments/cx7as1/this_is_an_extremely_high_resolution_image/')}
                className="px-2.5 py-1 text-[11px] bg-orange-500/5 hover:bg-orange-500/15 border border-orange-500/10 text-orange-400 rounded transition-colors font-sans cursor-pointer"
              >
                Reddit Picture
              </button>
              <button 
                type="button"
                onClick={() => loadPresetLink('https://files.testfile.org/PDF/10MB-testfile.org.pdf')}
                className="px-2.5 py-1 text-[11px] bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/10 text-emerald-400 rounded transition-colors font-sans cursor-pointer"
              >
                Direct 10MB PDF File
              </button>
            </div>

            <button 
              type="button"
              onClick={() => {
                setShowCookies(!showCookies);
                setCookiesContent('');
              }}
              className={`px-3 py-1 text-[11px] font-sans flex items-center gap-1.5 rounded border transition-all cursor-pointer ${
                cookiesLoaded 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold hover:bg-emerald-500/15' 
                  : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              {cookiesLoaded ? 'Bot Protection Active (Cookies Configured)' : 'Configure YouTube Bot Protection'}
            </button>
          </div>

          {/* Collapsible Cookie Configuration Drawer */}
          {showCookies && (
            <div className="mt-5 pt-4 border-t border-slate-800/60 animate-in slide-in-from-top-2 duration-200">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
                <div className="flex flex-col">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-sky-400" />
                    YouTube Session Cookies (Bot protection)
                  </h4>
                  <span className="text-[10px] text-slate-500 mt-0.5 max-w-[650px] leading-relaxed font-sans">
                    Servers are frequently rate-limited by YouTube. You can resolve the <strong>"Sign in to confirm you’re not a bot"</strong> error by pasting a Netscape or JSON cookies block. Copy your cookies using extensions like <strong>Getcookies.txt LOCALLY</strong> while logged in.
                  </span>
                </div>
                {cookiesLoaded && (
                  <button 
                    type="button"
                    onClick={() => handleSaveCookies('')}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors font-semibold font-sans cursor-pointer uppercase tracking-widest bg-red-500/5 border border-red-500/10 px-2 py-1 rounded-sm"
                  >
                    Wipe Active Session Cookies
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <textarea 
                  value={cookiesContent}
                  onChange={(e) => setCookiesContent(e.target.value)}
                  placeholder="# Netscape HTTP Cookie File&#10;# This file was generated by cookies exporter...&#10;.youtube.com&#10;..."
                  className="w-full h-32 bg-[#0A0B0E] border border-slate-800 focus:border-sky-500 rounded-md p-3 text-xs font-mono text-slate-300 focus:outline-none placeholder-slate-700 shadow-inner resize-y"
                />
                <div className="flex justify-end gap-2 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setShowCookies(false)}
                    className="px-3.5 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md text-xs font-bold transition-all cursor-pointer"
                  >
                    CLOSE
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleSaveCookies()}
                    disabled={!cookiesContent.trim()}
                    className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-white disabled:bg-slate-800 disabled:text-slate-600 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 hover:shadow-lg shadow-sky-500/10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    SAVE AND ACTIVATE COOKIES
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Dynamic Stream Inspecting Results Block */}
        {analyzedVideo && (
          <section className="bg-[#141720] border-2 border-sky-500/30 rounded-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Media Card Preview */}
              <div className="w-full lg:w-72 h-44 bg-slate-900 rounded-md overflow-hidden relative border border-slate-800/80 flex-shrink-0">
                <img 
                  src={analyzedVideo.thumbnail} 
                  onError={(e) => {
                    // Fallback thumbnail if broken or forbidden
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&h=250&q=80';
                  }}
                  alt={analyzedVideo.title} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                {analyzedVideo.duration && (
                  <span className="absolute bottom-2 right-2 text-xs font-mono bg-black/90 px-2 py-0.5 rounded-sm text-white border border-slate-800">
                    <Clock className="w-3 h-3 inline-block mr-1" />
                    {formatDuration(analyzedVideo.duration)}
                  </span>
                )}
              </div>

              {/* Configure Output details */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-sm border border-sky-400/10">
                      RESOLVED METADATA
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400 font-medium font-mono">{analyzedVideo.uploader}</span>
                  </div>

                  {/* Custom human title editor to change filename before download stream */}
                  <div className="grid gap-2">
                    <label className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">Local File Saver Title</label>
                    <input 
                      type="text"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      className="bg-[#0A0B0E] border border-slate-800 focus:border-sky-500 px-3.5 py-2.5 rounded-md text-sm text-slate-100 placeholder-slate-600 transition-colors"
                      placeholder="Title on downloaded disk"
                    />
                  </div>

                  {/* Choose Retention & Saving Target Selector */}
                  <div className="grid gap-2 mt-4">
                    <label className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">Download Destination Target</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        type="button"
                        onClick={() => setDownloadTarget('browser')}
                        className={`flex flex-col items-start p-3 bg-[#0A0B0E] border rounded-md transition-all text-left cursor-pointer ${
                          downloadTarget === 'browser'
                            ? 'border-sky-500 bg-sky-500/10'
                            : 'border-slate-800 hover:border-slate-700/80'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Download className={`w-3.5 h-3.5 ${downloadTarget === 'browser' ? 'text-sky-400' : 'text-slate-550'}`} />
                          Download to Browser (Auto-Save)
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 leading-normal">
                          The server handles processing in background, and automatically triggers your browser's local save dialog upon completion.
                        </span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setDownloadTarget('server')}
                        className={`flex flex-col items-start p-3 bg-[#0A0B0E] border rounded-md transition-all text-left cursor-pointer ${
                          downloadTarget === 'server'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-800 hover:border-slate-700/80'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <HardDrive className={`w-3.5 h-3.5 ${downloadTarget === 'server' ? 'text-emerald-400' : 'text-slate-550'}`} />
                          Save to Cloud Server Storage Only
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 leading-normal">
                          Stores completed file in your server cabinet. Perfect for keeping files organized cloud-side or fetching manually later.
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  {/* Quality selector */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                      Available Stream Format
                    </span>
                    <select
                      value={selectedFormatId}
                      onChange={(e) => setSelectedFormatId(e.target.value)}
                      className="bg-[#0A0B0E] border border-slate-800 text-slate-200 outline-none text-sm rounded-md px-3 py-3 focus:border-sky-500 transition-colors cursor-pointer w-full"
                    >
                      {analyzedVideo.formats.map((fmt) => (
                        <option key={fmt.formatId} value={fmt.formatId}>
                          [{fmt.extension.toUpperCase()}] {fmt.resolution} {fmt.note ? `(${fmt.note})` : ''} — {formatSize(fmt.filesize)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAnalyzedVideo(null)}
                      className="border border-slate-800 hover:bg-slate-800 font-bold px-4 py-3 rounded-md transition-all cursor-pointer text-xs"
                    >
                      CANCEL
                    </button>
                    <button 
                      onClick={handleInitiateDownload}
                      className="flex-1 bg-sky-500 hover:bg-sky-400 text-white font-bold px-6 py-3 rounded-md transition-all shadow-lg cursor-pointer shadow-sky-400/20 text-xs flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      RUN STREAM RETRIEVAL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Unified Transfers Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#141720] border border-slate-800/80 rounded-lg p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Transfers
              <span className="text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full font-mono font-medium">
                {jobs.length} Total
              </span>
            </h3>
            {jobs.some(j => ['pending', 'downloading', 'processing'].includes(j.status)) && (
              <span className="text-xs text-slate-500 font-mono animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                Processing stream chunks...
              </span>
            )}
          </div>

          {/* Scrollable list of transfers */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[500px]">
            {jobs.length === 0 ? (
              <div className="bg-[#0D0E12]/30 border border-dashed border-slate-800/60 rounded-lg p-12 text-center flex flex-col items-center justify-center text-slate-500">
                <div className="w-12 h-12 rounded-full border border-slate-800 bg-[#0F1117] flex items-center justify-center mb-3">
                  <Globe className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400">No transfers in progress or completed yet.</p>
              </div>
            ) : (
              jobs.map((job) => {
                const isActive = ['pending', 'downloading', 'processing'].includes(job.status);
                const isCompleted = job.status === 'completed';
                const isFailed = job.status === 'failed';

                return (
                  <div 
                    key={job.id} 
                    className={`border rounded-md p-4 flex flex-col md:flex-row items-center gap-4 transition-all shadow-xl ${
                      isCompleted 
                        ? 'bg-[#101F1D]/40 border-emerald-500/10 hover:border-emerald-500/30' 
                        : isFailed 
                        ? 'bg-[#2A1015]/20 border-red-500/10 hover:border-red-500/30' 
                        : 'bg-[#0D0E12]/80 border-slate-800/80 hover:border-slate-700/60'
                    }`}
                  >
                    {/* Media representation */}
                    <div className="w-full md:w-32 h-20 bg-[#0A0B0E] rounded-md shrink-0 overflow-hidden relative border border-slate-800/60 flex items-center justify-center">
                      {job.thumbnail ? (
                        <img 
                          src={job.thumbnail} 
                          onError={(e) => { e.currentTarget.src = ''; }}
                          className="w-full h-full object-cover" 
                          alt="" 
                        />
                      ) : (
                        <div className="text-slate-600 flex flex-col items-center gap-1">
                          {job.formatId.includes('audio') ? <Music className="w-5 h-5 text-sky-400" /> : <Video className="w-5 h-5 text-sky-400" />}
                          <span className="text-[9px] uppercase tracking-wider font-mono">Stream</span>
                        </div>
                      )}
                      
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/75 text-[8px] font-mono border border-slate-800 text-sky-400 rounded-sm">
                        {job.formatId.toUpperCase()}
                      </div>
                    </div>

                    {/* Progress tracking details */}
                    <div className="flex-1 w-full min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-slate-200 truncate" title={job.title}>{job.title}</h4>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {job.downloadTarget === 'browser' ? (
                              <span className="text-[9px] font-sans font-medium text-sky-400/80 bg-sky-500/5 px-2 py-0.5 rounded-full border border-sky-400/10 flex items-center gap-1">
                                <Download className="w-2.5 h-2.5" /> Auto-Save to Browser
                              </span>
                            ) : (
                              <span className="text-[9px] font-sans font-medium text-emerald-400/80 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10 flex items-center gap-1">
                                <HardDrive className="w-2.5 h-2.5" /> Saved to Server Cabinet
                              </span>
                            )}
                            <span className="text-[9px] font-sans font-medium text-purple-400/80 bg-purple-500/5 px-2 py-0.5 rounded-full border border-purple-400/10 flex items-center gap-1 uppercase tracking-wider">
                              {job.engine || 'yt-dlp'}
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 font-bold ${
                          isCompleted 
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                            : isFailed 
                            ? 'text-red-400 bg-red-500/10 border border-red-500/20' 
                            : 'text-sky-400 bg-sky-500/10 border border-sky-400/20'
                        }`}>
                          {job.status === 'processing' 
                            ? 'PROCESSING...' 
                            : isCompleted 
                            ? 'SUCCESS' 
                            : isFailed 
                            ? 'FAILED' 
                            : `${Math.round(job.progress)}%`}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-500 mb-1">
                        {isActive ? (
                          <>
                            <span>Speed: {job.speed}</span>
                            <span>Size: {job.totalSize}</span>
                          </>
                        ) : (
                          <>
                            <span>Size on Disk: {job.totalSize || 'N/A'}</span>
                            <span className="text-slate-600 truncate max-w-[200px]">{job.filename || 'media-stream'}</span>
                          </>
                        )}
                      </div>

                      {/* Glowing custom progress bar */}
                      <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40 relative">
                        <div 
                          className={`h-full opacity-90 transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-emerald-500' 
                              : isFailed 
                              ? 'bg-red-500' 
                              : job.status === 'processing' 
                              ? 'bg-amber-500 w-full animate-pulse' 
                              : 'bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>

                      {/* Extra metadata and browser download controls */}
                      <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                        {isActive ? (
                          <div className="flex gap-4">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3" /> 
                              ETA: {job.eta}
                            </span>
                            <span className="text-slate-700">•</span>
                            <span>Queued: {new Date(job.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        ) : isFailed ? (
                          <span className="text-red-500/80 font-sans font-medium line-clamp-1" title={job.error || ''}>
                            Error: {job.error || 'The stream extraction failed.'}
                          </span>
                        ) : job.fileDeletedFromHost ? (
                          <span className="text-emerald-500/80 font-sans font-medium">Saved directly to your browser.</span>
                        ) : (
                          <span className="text-emerald-500/80 font-sans font-medium">Successfully processed and buffered.</span>
                        )}

                        {isCompleted && (
                          job.fileDeletedFromHost ? (
                            <span className="text-[11px] font-sans font-bold text-emerald-400/90 bg-emerald-500/5 px-3 py-1.5 rounded-md border border-emerald-500/10 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              DOWNLOADED & PURGED FROM HOST
                            </span>
                          ) : (
                            <a 
                              href={`/api/download/${job.id}`}
                              download
                              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-1.5 rounded-md border border-sky-400/20 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              SAVE TO BROWSER
                            </a>
                          )
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0">
                      <button 
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-2 bg-[#0A0B0E] border border-slate-800 hover:border-red-900/60 hover:bg-red-950/20 rounded-md transition-all text-slate-500 hover:text-red-400 group cursor-pointer"
                        title={isActive ? "Cancel Queue" : "Wipe record & caching"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>

      {/* Aesthetic Dashboard Footer */}
      <footer 
        style={{ backgroundColor: APP_COLORS.bgHeader }}
        className="h-12 border-t border-slate-800/60 px-6 md:px-8 flex items-center justify-between text-[11px] font-mono text-slate-500 shrink-0"
      >
        <div>
          <span>appu-dlp © {new Date().getFullYear()}</span>
        </div>
      </footer>

    </div>
  );
}
