#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TruSaaS — Hetzner 1-Click Update & Zero-Downtime Reload
#
# Pulls latest code, builds all packages/apps, and triggers PM2 zero-downtime reload.
# ==============================================================================

REPO_DIR="/var/www/trusaas"
cd "${REPO_DIR}"

echo "=================================================="
echo "  Deploying TruSaaS Stack to Hetzner..."
echo "=================================================="

# 1. Pull latest code
echo "--> Pulling latest main branch..."
git fetch origin main
git reset --hard origin/main

# 2. Install shared dependencies & market scraper
echo "--> Installing dependencies & building shared packages..."
npm install --production=false

echo "--> Building packages/market-scraper..."
cd packages/market-scraper && npm install && npm run build && cd "${REPO_DIR}"

echo "--> Building truflow-premium..."
cd truflow-premium && npm install && npm run build && cd "${REPO_DIR}"

echo "--> Building truinspect..."
cd truinspect && npm install && npm run build && cd "${REPO_DIR}"

echo "--> Building TruLens..."
cd TruLens && npm install && npm run build && cd "${REPO_DIR}"

echo "--> Setting up truflow-mobile..."
cd truflow-mobile && npm install --production && cd "${REPO_DIR}"

# 3. Reload PM2 ecosystem with zero downtime
echo "--> Reloading PM2 processes..."
pm2 startOrReload tools/hetzner/ecosystem.config.cjs --update-env
pm2 save

# 4. Reload Caddy configuration
echo "--> Reloading Caddy reverse proxy..."
systemctl reload caddy

echo "=================================================="
echo "  ✓ TruSaaS Deployment Complete!"
echo "=================================================="
pm2 status
