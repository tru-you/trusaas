#!/usr/bin/env bash
# deploy-trucrm.sh — Deploy TruCRM to Hetzner bare-metal server
# Run as root on 2.29.17.123
#
# Prerequisites:
#   - Node.js 20+ installed
#   - PM2 installed globally
#   - Caddy installed and running
#   - Git access to github.com/tru-you/TRUCRM
#
# Usage:
#   scp deploy-trucrm.sh root@2.29.17.123:/tmp/ && ssh root@2.29.17.123 'bash /tmp/deploy-trucrm.sh'

set -euo pipefail

REPO_URL="https://github.com/tru-you/TRUCRM.git"
APP_DIR="/var/www/trusaas/TruCRM"
DATA_DIR="/var/data/trusaas/crm"
ECOSYSTEM="/var/www/trusaas/tools/hetzner/ecosystem.config.cjs"
CADDYFILE="/var/www/trusaas/tools/hetzner/Caddyfile"

echo "═══════════════════════════════════════════════════════"
echo "  TruCRM Hetzner Deployment"
echo "═══════════════════════════════════════════════════════"

# ── 1. Clone or pull the TruCRM repo ─────────────────────
echo ""
echo "▸ Step 1: Clone / update TruCRM repository..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repo exists — pulling latest..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/main
else
  echo "  Cloning fresh..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 2. Install dependencies & build ──────────────────────
echo ""
echo "▸ Step 2: Install dependencies & build..."
npm install --production=false   # devDeps needed for esbuild/vite build
npm run build
echo "  ✓ Build complete — dist/server.cjs and dist/scrape-worker.cjs ready"

# ── 3. Create data directory ─────────────────────────────
echo ""
echo "▸ Step 3: Create data directory..."
mkdir -p "$DATA_DIR"
echo "  ✓ $DATA_DIR ready"

# ── 4. Install Chromium system dependencies (for scraper worker) ──
echo ""
echo "▸ Step 4: Install Chromium system dependencies..."
apt-get update -qq
apt-get install -y -qq \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  libxshmfence1 \
  fonts-liberation \
  2>/dev/null || echo "  ⚠ Some packages may already be installed"
echo "  ✓ Chromium system deps installed"

# ── 5. Verify config files ───────────────────────────────
echo ""
echo "▸ Step 5: Verify config files..."
if [ -f "$ECOSYSTEM" ]; then
  echo "  ✓ ecosystem.config.cjs found at $ECOSYSTEM"
else
  echo "  ⚠ ecosystem.config.cjs not found at $ECOSYSTEM"
  echo "    Copy the updated file from your local tools/hetzner/ directory"
fi

if [ -f "$CADDYFILE" ]; then
  echo "  ✓ Caddyfile found at $CADDYFILE"
else
  echo "  ⚠ Caddyfile not found at $CADDYFILE"
  echo "    Copy the updated file from your local tools/hetzner/ directory"
fi

# ── 6. Restart PM2 with updated ecosystem ────────────────
echo ""
echo "▸ Step 6: Restart PM2..."
cd /var/www/trusaas
pm2 stop trucrm trucrm-scraper 2>/dev/null || true
pm2 delete trucrm trucrm-scraper 2>/dev/null || true
pm2 start "$ECOSYSTEM"
pm2 save
echo "  ✓ PM2 restarted with TruCRM"

# ── 7. Reload Caddy ─────────────────────────────────────
echo ""
echo "▸ Step 7: Reload Caddy..."
caddy reload --config "$CADDYFILE" --adapter caddyfile 2>/dev/null \
  || caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null \
  || echo "  ⚠ Could not auto-reload Caddy — reload manually: caddy reload --config $CADDYFILE"
echo "  ✓ Caddy reloaded"

# ── 8. Health checks ────────────────────────────────────
echo ""
echo "▸ Step 8: Health checks..."
sleep 3

CRM_HEALTH=$(curl -sf http://127.0.0.1:3005/api/health 2>/dev/null || echo '{"ok":false}')
SCRAPER_HEALTH=$(curl -sf http://127.0.0.1:10010/api/health 2>/dev/null || echo '{"ok":false}')

echo "  TruCRM (3005):         $CRM_HEALTH"
echo "  TruCRM Scraper (10010): $SCRAPER_HEALTH"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Deployment complete!"
echo ""
echo "  CRM:     http://127.0.0.1:3005"
echo "  Scraper: http://127.0.0.1:10010"
echo ""
echo "  ⚡ Next steps:"
echo "  1. Add DNS A record:"
echo "     crm.trusaas.dev → 2.29.17.123"
echo "  2. Set env vars on the server (if not already):"
echo "     export GEOAPIFY_API_KEY=..."
echo "     export ADZUNA_APP_ID=..."
echo "     export ADZUNA_APP_KEY=..."
echo "     Then: pm2 restart ecosystem.config.cjs"
echo "  3. Caddy will auto-provision SSL once DNS resolves"
echo "═══════════════════════════════════════════════════════"
