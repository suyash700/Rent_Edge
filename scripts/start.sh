#!/bin/bash
cd cd /home/ubuntu/rentedge

pkill node || true

nohup node server.js > app.log 2>&1 &
