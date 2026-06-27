# makedemo web app — needs a real Chromium (Puppeteer) and ffmpeg at runtime.
FROM node:20-bookworm-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=3000

# System Chromium + ffmpeg + fonts for legible screenshots.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ffmpeg \
      ca-certificates \
      fonts-liberation \
      fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Install dependencies for the whole workspace.
COPY . .
RUN pnpm install

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
