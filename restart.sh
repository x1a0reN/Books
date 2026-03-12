#!/bin/bash
pid=$(ss -tlnp sport = :8000 | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -n 1)
if [ -n "$pid" ]; then
  kill -9 $pid
fi
cd /root/NovelSite/backend
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > /root/NovelSite/backend.log 2>&1 &
