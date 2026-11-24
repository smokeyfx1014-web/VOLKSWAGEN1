# Multi-stage production Dockerfile for the Multi-Branch VW Dealership Platform
# Requires Node.js 22+ so `node server.ts` executes TypeScript natively without tsx.

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled frontend bundle and Node 22 server runtime files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/src/lib/autotraderParser.ts ./src/lib/autotraderParser.ts
COPY --from=builder /app/src/types/dealership.ts ./src/types/dealership.ts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.ts"]
