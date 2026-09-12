#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TruSaaS — Hetzner Server Provisioning & Initial Setup
# 
# Installs Caddy, PM2, configures firewall, and sets up isolated data directories.
# ==============================================================================

echo "=================================================="
echo "  TruSaaS Server Setup Initializing..."
echo "=================================================="

# 1. Update system packages
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git build-essential ufw tar gzip

# 2. Verify Node.js (v18+)
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "✓ Node.js version: $(node -v)"
echo "✓ NPM version: $(npm -v)"

# 3. Install PM2 globally
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

# 4. Install Caddy Web Server (Automated HTTPS)
if ! command -v caddy &> /dev/null; then
  echo "Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# 5. Create Persistent Data and Web Directories
mkdir -p /var/www/trusaas
mkdir -p /var/data/trusaas/premium
mkdir -p /var/data/trusaas/inspect
mkdir -p /var/data/trusaas/lens
mkdir -p /var/backups/trusaas

# Set permissions
chmod -R 755 /var/data/trusaas
chmod -R 755 /var/backups/trusaas

# 6. Configure UFW Firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy ACME)
ufw allow 443/tcp   # HTTPS (Caddy)
ufw --force enable

# 7. Setup daily backup cron (at 03:00 AM daily)
CRON_JOB="0 3 * * * /var/www/trusaas/tools/hetzner/backup.sh >> /var/log/trusaas-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "/var/www/trusaas/tools/hetzner/backup.sh" ; echo "$CRON_JOB") | crontab -

echo "=================================================="
echo "  Setup Complete! Next: Clone repository & deploy."
echo "=================================================="
