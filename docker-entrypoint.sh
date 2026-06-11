#!/bin/sh
set -e

SECRET_FILE=/app/config/.session_secret
mkdir -p /app/config /data

# Honor SESSION_SECRET (standard name); fall back to SECRET_KEY (legacy).
# If neither is set, auto-generate and persist in the secret file.
if [ -n "${SESSION_SECRET:-}" ]; then
  # Already set — export as both names so lib/session.ts finds it either way
  export SESSION_SECRET
  export SECRET_KEY="${SESSION_SECRET}"
elif [ -n "${SECRET_KEY:-}" ]; then
  # Legacy name provided — propagate as the standard name too
  export SECRET_KEY
  export SESSION_SECRET="${SECRET_KEY}"
else
  # Neither set — use or generate the persisted secret file
  if [ ! -s "$SECRET_FILE" ]; then
    node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64"))' > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE" 2>/dev/null || true
  fi
  SECRET_KEY="$(cat "$SECRET_FILE")"
  export SECRET_KEY
  export SESSION_SECRET="${SECRET_KEY}"
fi

# Fix permissions on mounted volumes, then drop to nextjs user
chown -R nextjs:nodejs /app/config /data 2>/dev/null || true
exec su-exec nextjs node /app/server.js
