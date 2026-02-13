#!/bin/sh
set -e

echo "🦦 Otter Money API starting..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
MAX_RETRIES=30
RETRY=0
until echo "SELECT 1" | npx prisma db execute --stdin --schema=./prisma/schema.prisma > /dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "❌ Database not reachable after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "  Attempt $RETRY/$MAX_RETRIES - retrying in 2s..."
  sleep 2
done
echo "✅ Database is ready"

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Optionally seed the database
if [ "$SEED_DB" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed
fi

# Start the server
echo "🚀 Starting server..."
exec node apps/api/dist/index.js
