#!/bin/sh
set -e

SECRET_FILE=/app/config/.session_secret
mkdir -p /app/config /data

if [ -z "${SECRET_KEY:-}" ]; then
  if [ ! -s "$SECRET_FILE" ]; then
    node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64"))' > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE" 2>/dev/null || true
  fi
  SECRET_KEY="$(cat "$SECRET_FILE")"
  export SECRET_KEY
fi

# Fix permissions on mounted volumes, then drop to nextjs user
# Only touches what isn't already owned, so a large library doesn't slow every restart.
find /app/config /data ! -user nextjs -exec chown nextjs:nodejs {} + 2>/dev/null || true
exec su-exec nextjs node /app/server.js
