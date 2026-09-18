FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip build-essential ca-certificates procps \
    && pip3 install --no-cache-dir --break-system-packages --upgrade --pre "yt-dlp[default]" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD pgrep -f "node dist/index.js" > /dev/null || exit 1

CMD ["node", "dist/index.js"]
