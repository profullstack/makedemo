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

# Playwright Chromium for the pipeline-brain recorder (MKDEMO_PIPELINE_BRAIN=1).
# Run inside @makedemo/core, where playwright is a direct dep (its bin isn't
# hoisted to the workspace root). Harmless when the brain is disabled.
RUN pnpm --filter @makedemo/core exec playwright install --with-deps chromium

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
