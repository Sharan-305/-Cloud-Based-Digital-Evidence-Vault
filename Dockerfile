# Multi-stage Dockerfile for Cloud-Based Digital Evidence Vault
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency manifests
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /usr/src/app/backend
RUN npm ci --omit=dev

# Production stage
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# Install dumb-init or use node user for security
RUN apk add --no-cache dumb-init

# Copy installed production node_modules and app code
COPY --chown=node:node --from=builder /usr/src/app/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend ./backend
COPY --chown=node:node frontend ./frontend
COPY --chown=node:node docs ./docs

# Set non-root user
USER node

EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/src/server.js"]
