#!/bin/bash
# ─── MailFlow Pro — Droplet Bootstrap Script ─────────────────────────────────
# Run this ONCE on a fresh Ubuntu 22.04 Droplet as root
# Usage: bash server-setup.sh

set -e
echo "=== MailFlow Pro Server Setup ==="

# 1. Update system
apt-get update -y && apt-get upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 3. Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# 4. Install certbot for SSL
apt-get install -y certbot

# 5. Install git
apt-get install -y git

# 6. Create app user (optional hardening)
# useradd -m -s /bin/bash appuser
# usermod -aG docker appuser

# 7. Clone the repo
cd /opt
git clone https://github.com/krishanbikram/Email-Tool.git emailtool
cd emailtool

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. cd /opt/emailtool"
echo "  2. cp .env.prod.example .env.prod"
echo "  3. nano .env.prod   ← fill in your secrets"
echo "  4. docker compose -f docker-compose.prod.yml up -d --build"
echo "  5. docker compose -f docker-compose.prod.yml exec backend npx prisma db push"
echo "  6. docker compose -f docker-compose.prod.yml exec backend npx ts-node prisma/seed.ts"
echo ""
echo "For SSL (after DNS points to this server):"
echo "  certbot certonly --webroot -w /var/www/certbot -d yourdomain.com"
echo "  Then uncomment the HTTPS block in nginx/default.conf"
echo "  docker compose -f docker-compose.prod.yml restart nginx"
