#!/bin/bash
set -e

echo "=== [CI/CD Deploy] Starting Production Deployment ==="

# Navigate to project directory (either script parent dir or /root/tebeka_portal_backend fallback)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${DEPLOY_DIR:-$SCRIPT_DIR}"

echo "--> Working directory: $(pwd)"

# Disable NX interactive TUI and daemon for CI/CD
export NX_DAEMON=false
export NX_TUI=false
export CI=true
unset NODE_OPTIONS

echo "--> Pulling latest code..."
git pull origin main || git pull origin master

echo "--> Installing dependencies..."
npm install

echo "--> Generating Prisma clients..."
npx prisma generate --schema=apps/user-service/prisma/schema.prisma
npx prisma generate --schema=apps/marketplace-service/prisma/schema.prisma
npx prisma generate --schema=apps/financial-service/prisma/schema.prisma
npx prisma generate --schema=apps/communication-service/prisma/schema.prisma

echo "--> Building production microservices..."
npx nx build api-gateway
npx nx build user-service
npx nx build marketplace-service
npx nx build financial-service
npx nx build communication-service

echo "--> Syncing database schemas..."
./node_modules/.bin/prisma db push --schema=./apps/user-service/prisma/schema.prisma --accept-data-loss
./node_modules/.bin/prisma db push --schema=./apps/marketplace-service/prisma/schema.prisma --accept-data-loss
./node_modules/.bin/prisma db push --schema=./apps/financial-service/prisma/schema.prisma --accept-data-loss
./node_modules/.bin/prisma db push --schema=./apps/communication-service/prisma/schema.prisma --accept-data-loss

echo "--> Reloading PM2 processes..."
pm2 start ecosystem.config.js --update-env || pm2 reload ecosystem.config.js --update-env
pm2 save

echo "=== [CI/CD Deploy] Deployment Complete & Live! ==="
