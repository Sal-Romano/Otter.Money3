# Build stage
FROM node:20-alpine AS builder

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

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 otter

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/prisma ./prisma

# Set ownership
RUN chown -R otter:nodejs /app

USER otter

EXPOSE 4000

CMD ["node", "dist/index.js"]
