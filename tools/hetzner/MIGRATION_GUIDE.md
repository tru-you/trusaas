# 🚀 TruSaaS Hetzner Migration & Production Setup Blueprint

This blueprint covers migrating the entire TruSaaS suite (TruFlow Premium, TruInspect, TruLens, TruFlow Mobile, and TruRadar Scraper) from Render to Hetzner Cloud / Dedicated with zero data loss, rolling daily backups, and automated SSL.

---

## 1. Recommended Hetzner Server Specs

- **Location**: Falkenstein (FSN1) or Nuremberg (NBG1) (Germany) / Helsinki (HEL1)
- **Type**: Hetzner Cloud **CPX31** (4 vCPU, 8 GB RAM, 160 GB NVMe SSD) or **CX32** (~€10 - €15 / month).
- **Operating System**: **Ubuntu 24.04 LTS** or **Ubuntu 22.04 LTS x64**
- **Networking**: Public IPv4 + IPv6, standard Hetzner Firewall.

---

## 2. Directory Structure on Hetzner

```
/var/www/trusaas/             # Application repository (monorepo)
/var/data/trusaas/            # Persistent storage (isolated from git code)
  ├── premium/                # TruFlow DMS json databases, ledgers, & media
  ├── inspect/                # TruInspect condition reports & media
  └── lens/                   # TruLens photo studio local databases & media
/var/backups/trusaas/         # Rolling 14-day automated backup archives (.tar.gz)
```

---

## 3. Step-by-Step Provisioning Arc

### Step 1: Initialize the Server
SSH into your fresh Hetzner server:
```bash
ssh root@<YOUR_HETZNER_IP>
```

Clone the repository and run the setup script:
```bash
mkdir -p /var/www
git clone https://github.com/TruSaaS/TruDealerMaster.git /var/www/trusaas
cd /var/www/trusaas/tools/hetzner
chmod +x setup.sh deploy.sh backup.sh sync-data.sh
./setup.sh
```
This automatically installs:
- Node.js 20 LTS & NPM
- PM2 process manager
- Caddy web server with automatic Let's Encrypt SSL
- UFW firewall rules (22, 80, 443)
- Daily automated backup cronjob (`03:00 AM`)

---

### Step 2: Configure Environment Variables
Create `/var/www/trusaas/.env` (or set environment variables in `/var/www/trusaas/tools/hetzner/ecosystem.config.cjs`):

```bash
# Imagin8 / TransUnion credentials (SA platform)
IMAGIN8_API_KEY=<YOUR_IMAGIN8_API_KEY>
IMAGIN8_CUSTOMER_ID=<YOUR_IMAGIN8_CUSTOMER_ID>
IMAGIN8_USERNAME=<YOUR_IMAGIN8_USERNAME>
IMAGIN8_PASSWORD=<YOUR_IMAGIN8_PASSWORD>
IMAGIN8_APP_NAME=Flow

# Security & Inter-Service Keys
SYNC_SERVICE_KEY=<MASTER_SYNC_KEY>
TRUFLOW_SYNC_KEY=<MASTER_SYNC_KEY>

# Scraper & AI
BRIGHTDATA_API_KEY=<YOUR_BRIGHTDATA_API_KEY>
BRIGHTDATA_UNLOCKER_ZONE=<YOUR_ZONE>
DEEPSEEK_API_KEY=<YOUR_DEEPSEEK_API_KEY>
```

---

### Step 3: Migrate Persistent Data (Zero Data Loss)

If exporting from Render / existing instance:
1. Export the database archive:
   ```bash
   tar -czf /tmp/trusaas-render-backup.tar.gz -C <RENDER_DISK_DATA_DIR> .
   ```
2. Transfer to Hetzner:
   ```bash
   scp /tmp/trusaas-render-backup.tar.gz root@<YOUR_HETZNER_IP>:/tmp/
   ```
3. Import on Hetzner:
   ```bash
   cd /var/www/trusaas/tools/hetzner
   ./sync-data.sh import /tmp/trusaas-render-backup.tar.gz
   ```

---

### Step 4: Build & Launch Services
```bash
cd /var/www/trusaas/tools/hetzner
./deploy.sh
```

Configure Caddy:
```bash
cp /var/www/trusaas/tools/hetzner/Caddyfile /etc/caddy/Caddyfile
systemctl restart caddy
```

Verify running processes:
```bash
pm2 status
pm2 logs --lines 50
```

---

### Step 5: DNS Switchover (Cloudflare / Registrar)

Point your DNS A records to your Hetzner IP:
- `premium.tru-saas.com` → `<YOUR_HETZNER_IP>`
- `inspect.tru-saas.com` → `<YOUR_HETZNER_IP>`
- `lens.tru-saas.com` → `<YOUR_HETZNER_IP>`
- `app.tru-saas.com` → `<YOUR_HETZNER_IP>`
- `scraper.tru-saas.com` → `<YOUR_HETZNER_IP>`

*(Optional: staging domains `stage-premium.tru-saas.com`, etc. are already pre-configured in Caddyfile for pre-launch test verification).*

---

## 4. Maintenance & Backups

- **Manual On-Demand Backup**:
  ```bash
  /var/www/trusaas/tools/hetzner/backup.sh
  ```
- **Updates (Zero Downtime)**:
  ```bash
  /var/www/trusaas/tools/hetzner/deploy.sh
  ```
- **PM2 Monitoring Dashboard**:
  ```bash
  pm2 monit
  ```
