# Use official Node.js base image
FROM node:20-slim

# Install Python3, FFmpeg, and Curl (vital dependencies for yt-dlp to run and merge streams)
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install packages
RUN npm ci --include=dev

# Copy application files
COPY . .

# Compile/bundle the React frontend and Express backend
RUN npm run build

# Expose server port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
