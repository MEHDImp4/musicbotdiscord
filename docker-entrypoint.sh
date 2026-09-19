#!/bin/sh
set -e

if [ "${YTDLP_AUTO_UPDATE}" = "true" ]; then
  echo "[entrypoint] Mise à jour de yt-dlp..."
  timeout 90 /opt/ytdlp/bin/pip install -q --upgrade --pre "yt-dlp[default]" \
    || echo "[entrypoint] Échec de la mise à jour yt-dlp, poursuite avec la version installée"
fi

exec "$@"
