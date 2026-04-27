#!/bin/bash
cd /home/ubuntu/rentedge

npm install
npm run build

pm2 stop rentedge || true
pm2 start "node -r dotenv/config dist/index.cjs" --name rentedge
pm2 save
