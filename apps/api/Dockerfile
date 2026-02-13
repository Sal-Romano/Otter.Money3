# Build stage
FROM node:20-alpine AS builder

# OpenSSL needed for Prisma to detect correct binary target
RUN apk add --no-cache openssl

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source
COPY apps/api ./apps/api/
COPY packages/shared ./packages/shared/

# Generate Prisma client
RUN npx prisma generate

# Build shared package
RUN npm run build -w @otter-money/shared

# Build API
RUN npm run build -w @otter-money/api

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL (required by Prisma on Alpine)
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 otter

# Copy root package.json (needed for prisma seed config and workspace resolution)
COPY --from=builder /app/package.json ./

# Copy node_modules (includes prisma client, tsx for seeding, all deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy built API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy built shared package (needed for runtime imports)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy prisma (schema + migrations for migrate deploy + seed)
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set ownership
RUN chown -R otter:nodejs /app

USER otter

EXPOSE 4000

ENTRYPOINT ["docker-entrypoint.sh"]
