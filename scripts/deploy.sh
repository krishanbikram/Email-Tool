#!/bin/bash
# ─── MailFlow Pro — Deploy / Update Script ───────────────────────────────────
# Run this on the Droplet to pull latest code and restart
# Usage: bash scripts/deploy.sh

set -e
cd /opt/emailtool

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Rebuilding and restarting containers ==="
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "=== Running any new migrations ==="
docker compose -f docker-compose.prod.yml exec backend npx prisma db push

echo "=== ✅ Deploy complete ==="
docker compose -f docker-compose.prod.yml ps
