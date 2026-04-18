# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build frontend + install production deps ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# System deps needed to compile better-sqlite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV npm_config_fund=false \
    npm_config_audit=false

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Isolate a production node_modules to copy into the runtime image
RUN npm prune --omit=dev


# ---------- Stage 2: runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=8080 \
    NEXUS_DATA_DIR=/data \
    NEXUS_STATIC_DIR=/app/dist

# Non-root user for safety; UID/GID are overridable at runtime via --user
RUN useradd --system --create-home --uid 1000 --shell /usr/sbin/nologin nexus \
  && mkdir -p /data \
  && chown -R nexus:nexus /data /app

COPY --from=build --chown=nexus:nexus /app/node_modules ./node_modules
COPY --from=build --chown=nexus:nexus /app/dist ./dist
COPY --from=build --chown=nexus:nexus /app/server ./server
COPY --from=build --chown=nexus:nexus /app/base44 ./base44
COPY --from=build --chown=nexus:nexus /app/package.json ./package.json

USER nexus

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/index.js"]
