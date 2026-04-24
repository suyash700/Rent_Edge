#!/bin/bash
cd /home/ubuntu/rentedge

pm2 delete rentedge || true
pm2 start "node dist/index.cjs" --name rentedge
pm2 save