# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source
COPY apps/web ./apps/web/
COPY packages/shared ./packages/shared/

# Build shared package
RUN npm run build -w @otter-money/shared

# Build web app
RUN npm run build -w @otter-money/web

# Production stage - nginx to serve static files
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy public assets (logos, etc)
COPY src/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
