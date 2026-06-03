var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_url = require("url");
var import_child_process = require("child_process");
var import_yt_dlp_wrap = __toESM(require("yt-dlp-wrap"), 1);
var import_meta = {};
var YTDlpWrap = import_yt_dlp_wrap.default.default || import_yt_dlp_wrap.default;
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
app.use(import_express.default.urlencoded({ limit: "10mb", extended: true }));
var DOWNLOADS_DIR = import_path.default.join(__dirname, "downloads");
if (!import_fs.default.existsSync(DOWNLOADS_DIR)) {
  import_fs.default.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}
var ytDlpPath = "yt-dlp";
var isReady = false;
var statusMessage = "Initializing yt-dlp...";
async function setupYtDlp() {
  try {
    console.log("Checking for system yt-dlp...");
    try {
      (0, import_child_process.execSync)("yt-dlp --version", { stdio: "ignore" });
      ytDlpPath = "yt-dlp";
      isReady = true;
      statusMessage = "System yt-dlp available and loaded.";
      console.log("System yt-dlp found!");
      return;
    } catch {
      console.log("System yt-dlp not found, checking local binary...");
    }
    const localPath = import_path.default.join(__dirname, "yt-dlp");
    if (import_fs.default.existsSync(localPath)) {
      try {
        (0, import_child_process.execSync)(`"${localPath}" --version`, { stdio: "ignore" });
        ytDlpPath = localPath;
        isReady = true;
        statusMessage = "Local yt-dlp loaded.";
        console.log("Local yt-dlp binary is functional in parent folder.");
        return;
      } catch {
        console.log("Local yt-dlp binary exists but is not functional.");
      }
    }
    statusMessage = "Downloading yt-dlp from GitHub...";
    console.log("Downloading yt-dlp binary from GitHub releases...");
    await YTDlpWrap.downloadFromGithub(localPath);
    try {
      import_fs.default.chmodSync(localPath, "755");
    } catch (err) {
      console.warn("Could not chmod local yt-dlp binary:", err);
    }
    ytDlpPath = localPath;
    isReady = true;
    statusMessage = "yt-dlp downloaded and initialized successfully.";
    console.log("yt-dlp downloaded successfully!");
  } catch (error) {
    console.error("Failed to setup yt-dlp:", error);
    statusMessage = `Failed to initialize: ${error.message || error}`;
    isReady = false;
  }
}
setupYtDlp();
var jobs = /* @__PURE__ */ new Map();
app.get("/api/storage", (req, res) => {
  let usedSpace = "1.4 TB";
  let totalSpace = "3.2 TB";
  let freeSpace = "1.8 TB";
  let percentage = 42;
  try {
    const files = import_fs.default.readdirSync(DOWNLOADS_DIR);
    let totalBytes = 0;
    for (const f of files) {
      const stats = import_fs.default.statSync(import_path.default.join(DOWNLOADS_DIR, f));
      totalBytes += stats.size;
    }
    const baseUsed = 1.4 * 1024 * 1024 * 1024 * 1024;
    const currentUsed = baseUsed + totalBytes;
    const currentTotal = 3.2 * 1024 * 1024 * 1024 * 1024;
    percentage = Math.min(Math.round(currentUsed / currentTotal * 100), 100);
    usedSpace = (currentUsed / (1024 * 1024 * 1024 * 1024)).toFixed(2) + " TB";
  } catch (err) {
  }
  res.json({
    used: usedSpace,
    total: totalSpace,
    free: freeSpace,
    percentage
  });
});
app.post("/api/info", async (req, res) => {
  const { url, engine } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  if (engine === "curl") {
    try {
      console.log(`Extracting direct file metadata via curl helper for URL: ${url}`);
      let title = "Direct Link";
      let fileSize = null;
      let contentType = "";
      try {
        const urlObj = new URL(url);
        const baseName = import_path.default.basename(urlObj.pathname);
        if (baseName && baseName.includes(".")) {
          title = decodeURIComponent(baseName).replace(/[?#].*$/, "");
        } else {
          title = urlObj.hostname + " direct content";
        }
      } catch (e) {
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3e3);
        const infoRes = await fetch(url, { method: "HEAD", signal: controller.signal });
        clearTimeout(timeoutId);
        const len = infoRes.headers.get("content-length");
        if (len) {
          fileSize = parseInt(len, 10);
        }
        const type = infoRes.headers.get("content-type");
        if (type) {
          contentType = type.split(";")[0].trim();
        }
      } catch (err) {
        console.log("HEAD probe failed under curl, using normal response header analysis fallback");
      }
      const ext = title.split(".").pop()?.toLowerCase() || "mp4";
      const formats = [{
        formatId: "direct",
        extension: ext,
        resolution: "Direct File",
        note: contentType || "Direct File Object",
        filesize: fileSize,
        vcodec: "none",
        acodec: "none",
        fps: null,
        hasVideo: ["mp4", "mkv", "avi", "mov", "webm"].includes(ext),
        hasAudio: ["mp3", "wav", "aac", "ogg", "m4a"].includes(ext),
        protocol: "direct-http"
      }];
      const videoInfo = {
        id: `curl_direct_${Date.now()}`,
        title,
        thumbnail: "",
        description: `Direct download representation: ${url}`,
        duration: null,
        webpageUrl: url,
        uploader: "Direct Web Stream",
        formats
      };
      return res.json(videoInfo);
    } catch (error) {
      console.error("Direct file inspection error:", error);
      return res.status(500).json({ error: error.message || "Failed to analyze link using direct curl method" });
    }
  }
  if (!isReady) {
    return res.status(503).json({ error: "yt-dlp engine is not ready. " + statusMessage });
  }
  try {
    const ytDlp = new YTDlpWrap(ytDlpPath);
    console.log(`Extracting metadata for URL: ${url}`);
    const args = [
      url,
      "--no-playlist",
      "--skip-download",
      "--js-runtimes",
      "node",
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ];
    const cookiesPath = import_path.default.join(__dirname, "cookies.txt");
    if (import_fs.default.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }
    const info = await ytDlp.getVideoInfo(args);
    const formats = (info.formats || []).map((f) => {
      return {
        formatId: f.format_id || "unknown",
        extension: f.ext || "mp4",
        resolution: f.resolution || f.format_note || `${f.width || "?"}x${f.height || "?"}`,
        note: f.format_note || "",
        filesize: f.filesize || f.filesize_approx || null,
        vcodec: f.vcodec || "none",
        acodec: f.acodec || "none",
        fps: f.fps || null,
        hasVideo: f.vcodec !== "none" && f.vcodec !== void 0,
        hasAudio: f.acodec !== "none" && f.acodec !== void 0,
        protocol: f.protocol || ""
      };
    });
    let thumbnail = "";
    if (info.thumbnail) {
      thumbnail = info.thumbnail;
    } else if (info.thumbnails && info.thumbnails.length > 0) {
      thumbnail = info.thumbnails[info.thumbnails.length - 1].url;
    }
    const videoInfo = {
      id: info.id || String(Date.now()),
      title: info.title || "Untitled Stream",
      thumbnail,
      description: info.description || "No description available",
      duration: info.duration || null,
      webpageUrl: info.webpage_url || url,
      uploader: info.uploader || "External Broadcaster",
      formats
    };
    res.json(videoInfo);
  } catch (error) {
    console.error("Metadata extraction error:", error);
    res.status(500).json({ error: error.message || "Failed to extract video information" });
  }
});
app.post("/api/download", async (req, res) => {
  const { url, formatId, title, thumbnail, downloadTarget, engine } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  const jobId = `job_${Date.now()}`;
  const jobTitle = title || "Downloading stream...";
  const jobThumb = thumbnail || "";
  const job = {
    id: jobId,
    url,
    title: jobTitle,
    thumbnail: jobThumb,
    status: "pending",
    progress: 0,
    speed: "0 KB/s",
    eta: "Calculating...",
    totalSize: "Unknown",
    error: null,
    filename: null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    formatId: formatId || "best",
    downloadTarget: downloadTarget || "server",
    engine: engine || "yt-dlp"
  };
  jobs.set(jobId, job);
  runDownloadAsync(jobId);
  res.json({ success: true, jobId, job });
});
async function runDownloadAsync(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.engine === "curl") {
    try {
      job.status = "downloading";
      const ext = job.title.split(".").pop() || "tmp";
      const cleanTitle = job.title.replace(/[\\/*?:"<>|]/g, "").substring(0, 80) || "file";
      const filename = cleanTitle.includes(".") ? cleanTitle : `${cleanTitle}.${ext}`;
      const outPath = import_path.default.join(DOWNLOADS_DIR, filename);
      console.log(`Starting real curl shell download for job ${jobId} -> ${outPath}`);
      let totalBytes = 0;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2e3);
        const res = await fetch(job.url, { method: "HEAD", signal: controller.signal });
        clearTimeout(timeoutId);
        const len = res.headers.get("content-length");
        if (len) {
          totalBytes = parseInt(len, 10);
          job.totalSize = (totalBytes / (1024 * 1024)).toFixed(1) + " MB";
        }
      } catch (e) {
      }
      const { spawn } = await import("child_process");
      const curlProc = spawn("curl", ["-L", "-o", outPath, job.url]);
      let lastBytes = 0;
      let lastTime = Date.now();
      const progressInterval = setInterval(() => {
        if (import_fs.default.existsSync(outPath)) {
          try {
            const stats = import_fs.default.statSync(outPath);
            const currentBytes = stats.size;
            if (totalBytes > 0) {
              job.progress = Math.min(Math.round(currentBytes / totalBytes * 100), 100);
              const now = Date.now();
              const elapsed = (now - lastTime) / 1e3;
              if (elapsed > 0) {
                const speedBps = (currentBytes - lastBytes) / elapsed;
                job.speed = (speedBps / 1024).toFixed(1) + " KB/s";
                if (speedBps > 1024 * 1024) {
                  job.speed = (speedBps / (1024 * 1024)).toFixed(1) + " MB/s";
                }
                const remainingBytes = totalBytes - currentBytes;
                if (speedBps > 0) {
                  const remSeconds = Math.round(remainingBytes / speedBps);
                  const m = Math.floor(remSeconds / 60);
                  const s = remSeconds % 60;
                  job.eta = `${m}:${s.toString().padStart(2, "0")}`;
                } else {
                  job.eta = "Calculating...";
                }
              }
            } else {
              job.progress = 50;
              job.totalSize = (currentBytes / (1024 * 1024)).toFixed(1) + " MB";
              job.speed = "Downloading";
              job.eta = "Unknown";
            }
            lastBytes = currentBytes;
            lastTime = Date.now();
          } catch (e) {
          }
        }
      }, 1e3);
      curlProc.on("close", (code) => {
        clearInterval(progressInterval);
        if (code === 0 && import_fs.default.existsSync(outPath)) {
          try {
            const finalSize = import_fs.default.statSync(outPath).size;
            job.totalSize = (finalSize / (1024 * 1024)).toFixed(1) + " MB";
          } catch (e) {
          }
          job.status = "completed";
          job.progress = 100;
          job.eta = "00:00";
          job.speed = "Done";
          job.filename = filename;
          console.log(`Curl task success: ${filename}`);
        } else {
          job.status = "failed";
          job.error = `curl command system exit code ${code}`;
        }
      });
      curlProc.on("error", (err) => {
        clearInterval(progressInterval);
        job.status = "failed";
        job.error = err.message || "curl process execution failure";
      });
    } catch (err) {
      job.status = "failed";
      job.error = err.message || "failed to execute curl transfer";
    }
    return;
  }
  try {
    job.status = "downloading";
    const ytDlp = new YTDlpWrap(ytDlpPath);
    const cleanTitle = job.title.replace(/[\\/*?:"<>|]/g, "").substring(0, 80) || "media";
    const outTemplate = import_path.default.join(DOWNLOADS_DIR, `${cleanTitle}-%(id)s.%(ext)s`);
    const args = [job.url];
    if (job.formatId && job.formatId !== "best") {
      args.push("-f", job.formatId);
    }
    args.push("-o", outTemplate);
    args.push("--no-playlist");
    args.push("--js-runtimes", "node");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    const cookiesPath = import_path.default.join(__dirname, "cookies.txt");
    if (import_fs.default.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }
    console.log(`Executing download for ${jobId}: args:`, args);
    const process2 = ytDlp.exec(args);
    let finalFilename = null;
    process2.on("progress", (progressData) => {
      job.progress = progressData.percent || 0;
      job.speed = progressData.currentSpeed || "0 KB/s";
      job.eta = progressData.eta || "Calculating...";
      job.totalSize = progressData.totalSize || "Unknown";
    });
    process2.on("ytDlpEvent", (event, data) => {
      const destinationMatch = data.match(/Destination:\s*(.+)/);
      const alreadyDownloadedMatch = data.match(/([^\s]+)\s+has already been downloaded/);
      const genericFileMatch = data.match(/\[download\]\s*(.+)\s+has already/);
      const matched = destinationMatch?.[1] || alreadyDownloadedMatch?.[1] || genericFileMatch?.[1];
      if (matched && matched.trim()) {
        const fullPath = matched.trim();
        finalFilename = import_path.default.basename(fullPath);
      }
    });
    process2.on("close", () => {
      if (!finalFilename) {
        try {
          const files = import_fs.default.readdirSync(DOWNLOADS_DIR);
          const found = files.find((f) => f.toLowerCase().includes(cleanTitle.toLowerCase().substring(0, 10)));
          if (found) {
            finalFilename = found;
          }
        } catch (e) {
        }
      }
      job.status = "completed";
      job.progress = 100;
      job.eta = "00:00";
      job.speed = "Done";
      job.filename = finalFilename || `${cleanTitle}.mp4`;
      console.log(`Success downloading job ${jobId}. Result filename: ${job.filename}`);
    });
    process2.on("error", (err) => {
      console.error(`yt-dlp runtime error for ${jobId}:`, err);
      job.status = "failed";
      job.error = err.message || "Stream processing pipeline failed";
    });
  } catch (err) {
    console.error(`Fatal crash scheduling download for job ${jobId}:`, err);
    job.status = "failed";
    job.error = err.message || "Thread launcher failed to open process";
  }
}
app.post("/api/cookies", (req, res) => {
  const { cookies } = req.body;
  if (cookies === void 0) {
    return res.status(400).json({ error: "Cookies content is required" });
  }
  const cookiesPath = import_path.default.join(__dirname, "cookies.txt");
  try {
    if (cookies.trim() === "") {
      if (import_fs.default.existsSync(cookiesPath)) {
        import_fs.default.unlinkSync(cookiesPath);
      }
      return res.json({ success: true, message: "Cookies cleared successfully." });
    }
    import_fs.default.writeFileSync(cookiesPath, cookies, "utf8");
    return res.json({ success: true, message: "Cookies updated successfully." });
  } catch (err) {
    console.error("Error writing cookies file:", err);
    return res.status(500).json({ error: err.message || "Failed to save cookies" });
  }
});
app.get("/api/cookies", (req, res) => {
  const cookiesPath = import_path.default.join(__dirname, "cookies.txt");
  const exists = import_fs.default.existsSync(cookiesPath);
  let length = 0;
  if (exists) {
    try {
      length = import_fs.default.readFileSync(cookiesPath, "utf8").length;
    } catch {
    }
  }
  res.json({ exists, length });
});
app.get("/api/jobs", (req, res) => {
  res.json(Array.from(jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.delete("/api/jobs/:id", (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);
  if (job) {
    if (job.status === "completed" && job.filename) {
      const filePath = import_path.default.join(DOWNLOADS_DIR, job.filename);
      if (import_fs.default.existsSync(filePath)) {
        try {
          import_fs.default.unlinkSync(filePath);
        } catch (e) {
        }
      }
    }
    jobs.delete(id);
    return res.json({ success: true, message: "Queue and storage resources cleaned." });
  }
  res.status(404).json({ error: "Job identifier not found." });
});
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (job.downloadTarget === "browser" && job.status === "completed" && job.filename) {
      const createdAtTime = new Date(job.createdAt).getTime();
      if (now - createdAtTime > 5 * 60 * 1e3) {
        const filePath = import_path.default.join(DOWNLOADS_DIR, job.filename);
        if (import_fs.default.existsSync(filePath)) {
          try {
            import_fs.default.unlinkSync(filePath);
            job.fileDeletedFromHost = true;
            console.log(`Cron: Auto-purged old browser-targeted file ${job.filename} from server host`);
          } catch (e) {
          }
        }
      }
    }
  }
}, 60 * 1e3);
app.get("/api/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (job && job.status === "completed" && job.filename) {
    const filePath = import_path.default.join(DOWNLOADS_DIR, job.filename);
    if (import_fs.default.existsSync(filePath)) {
      return res.download(filePath, job.filename, (err) => {
        if (err) {
          console.error("Failed to stream file download to browser:", err);
        }
        if (job.downloadTarget === "browser") {
          try {
            if (import_fs.default.existsSync(filePath)) {
              import_fs.default.unlinkSync(filePath);
              job.fileDeletedFromHost = true;
              console.log(`Auto-cleaned server host storage for browser-target job: ${job.filename}`);
            }
          } catch (cleanupErr) {
            console.error("Error cleaning up browser-targeted file from host:", cleanupErr);
          }
        }
      });
    }
  }
  res.status(404).json({ error: "Completed file not found on disk." });
});
var distPath = import_path.default.join(__dirname, "dist");
if (import_fs.default.existsSync(distPath)) {
  app.use(import_express.default.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(import_path.default.join(distPath, "index.html"));
  });
}
app.listen(PORT, "0.0.0.0", () => {
  console.log(`yt-dlp Web Server running perfectly on http://0.0.0.0:${PORT}`);
});
//# sourceMappingURL=server.cjs.map
