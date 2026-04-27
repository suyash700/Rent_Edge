#!/bin/bash

cd /home/ubuntu/rentedge

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Running DB migrations..."
npx drizzle-kit push

echo "Starting app with PM2..."
pm2 delete all || true
pm2 start "node -r dotenv/config dist/index.cjs" --name rentedge
pm2 save
