# appu-dlp

A web file and media stream downloader interface built using React, yt-dlp/curl.

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
