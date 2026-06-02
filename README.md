# appu-dlp

A high-performance web file and media stream downloader interface built using React, Vite, Tailwind CSS, Express, and yt-dlp/curl.

## Design Philosophy

This application utilizes a strict, cohesive low-contrast dark canvas background combined with carefully balanced text layouts, custom typography, and compact borders to present a polished, technical space for stream downloads and media analysis.

## Key Features

- **Dual Engine Architecture**: Switch between yt-dlp for media extraction and curl for raw HTTP file buffering.
- **Dynamic Format Resolution**: Inspects target URLs to extract available video/audio formats and resolutions.
- **Configurable Transits**: Stream downloads directly via your browser with local browser saving, or buffer them on the host server disk.
- **Active Cookie Session Injection**: Import standard Netscape cookies directly from your web session to bypass authentication paywalls or restrictions.
- **Compact UI Boundaries**: Polished UI with compact border radii, unified transfer progress trackers, and real-time status banners.

## Getting Started

### Local Setup

Ensure Node.js is installed locally on your machine.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server (runs Express bound with Vite middleware):
   ```bash
   npm run dev
   ```

3. Build the server and client bundle:
   ```bash
   npm run build
   ```

4. Start in production mode:
   ```bash
   npm run start
   ```

### Docker Compose Deployment

The application is thoroughly optimized for Docker. You can deploy it using Docker Compose.

1. Ensure standard Docker and Compose utilities are installed on your host.
2. Run the container architecture with:
   ```bash
   docker compose up -d
   ```

The default exposed port is `3000`. You can configure a custom host-exposed port without modifying the compose file by exposing the `PORT` environment variable:

```bash
PORT=8080 docker compose up -d
```

### GitHub Actions Integration

A pre-configured CI/CD workflow is located in `.github/workflows/docker-publish.yml`. It triggers automatically on push/PR events to:
- `main`
- `master`
- `test`
- `production`

The workflow automatically builds and publishes production-ready images to the GitHub Container Registry (`ghcr.io`) using semantic tagging, short commit SHA designations, and the `latest` tag when triggered on your default target branch.
