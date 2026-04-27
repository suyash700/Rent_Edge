#!/bin/bash
cd /home/ec2-user/rentedge

pkill node || true

nohup node server.js > app.log 2>&1 &
