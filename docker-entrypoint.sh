#!/bin/sh
# Fix permissions on mounted volumes, then drop to nextjs user
chown -R nextjs:nodejs /app/config /data 2>/dev/null || true
exec su-exec nextjs node /app/server.js
