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

RUN apk add --no-cache su-exec dcraw && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Entrypoint: fixes volume permissions then drops to nextjs user
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create dirs; ownership is fixed at runtime by entrypoint
RUN mkdir -p /data /app/config

EXPOSE 7070

ENV PORT=7070
ENV HOSTNAME=0.0.0.0
ENV BASE_DIRECTORY=/data
ENV SITE_NAME=SkyBit

CMD ["/docker-entrypoint.sh"]
