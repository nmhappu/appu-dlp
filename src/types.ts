export interface VideoFormat {
  formatId: string;
  extension: string;
  resolution: string;
  note: string;
  filesize: number | null;
  vcodec: string;
  acodec: string;
  fps: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  protocol?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  duration: number | null; // in seconds
  webpageUrl: string;
  uploader: string;
  formats: VideoFormat[];
}

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress: number;
  speed: string;
  eta: string;
  totalSize: string;
  error: string | null;
  filename: string | null;
  createdAt: string;
  formatId: string;
  downloadTarget?: 'server' | 'browser';
  engine?: 'yt-dlp' | 'curl';
  fileDeletedFromHost?: boolean;
}
