# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native Node modules (better-sqlite3, sharp)
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Data and config directories (mount these as volumes)
RUN mkdir -p /data /app/config && chown -R nextjs:nodejs /data /app/config

USER nextjs

EXPOSE 7070

ENV PORT=7070
ENV HOSTNAME=0.0.0.0
ENV BASE_DIRECTORY=/data
ENV DATABASE_PATH=/app/config/skybit.db
ENV SITE_NAME=SkyBit

# To run:
#   docker build -t skybit .
#   docker run -p 7070:7070 \
#     -v /your/files:/data \
#     -v /your/config:/app/config \
#     -e SECRET_KEY=your-secret-key-32-chars-min \
#     skybit

CMD ["node", "server.js"]
