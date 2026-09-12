import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("2.29.17.123", username="root", password="3sXaLxfaArhp", timeout=10)

ecosystem = """
module.exports = {
  apps: [
    // ── 1. Production SA Stack ────────────────────────────
    {
      name: "trusaas-premium",
      cwd: "/var/www/trusaas/truflow-premium",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: 3003,
        DATA_DIR: "/var/data/trusaas/premium",
        MARKET: "za",
        VALUATION_ENGINE: "remote",
        SCRAPER_REMOTE_URL: "http://127.0.0.1:4300",
        IMAGIN8_APP_NAME: "Flow",
        SYNC_SERVICE_KEY: "truflow-sync-master-key",
      },
    },
    {
      name: "trusaas-inspect",
      cwd: "/var/www/trusaas/truinspect",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
        DATA_DIR: "/var/data/trusaas/inspect",
        MARKET: "za",
        DEFAULT_DMS_URL: "http://127.0.0.1:3003",
        TRUFLOW_SYNC_KEY: "truflow-sync-master-key",
        SCRAPER_REMOTE_URL: "http://127.0.0.1:4300",
        VALUATION_ENGINE: "remote",
      },
    },
    {
      name: "trusaas-lens",
      cwd: "/var/www/trusaas/TruLens",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        DATA_DIR: "/var/data/trusaas/lens",
        MARKET: "za",
        DEFAULT_DMS_URL: "http://127.0.0.1:3003",
        TRUFLOW_SYNC_KEY: "truflow-sync-master-key",
        SCRAPER_REMOTE_URL: "http://127.0.0.1:4300",
        VALUATION_ENGINE: "remote",
      },
    },
    {
      name: "trusaas-mobile",
      cwd: "/var/www/trusaas/truflow-mobile",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 3004,
        FLOW_BACKEND_URL: "http://127.0.0.1:3003",
      },
    },

    // ── 2. Shared Platform Services ───────────────────────
    {
      name: "scraper",
      cwd: "/var/www/trusaas/packages/market-scraper",
      script: "webapp/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 4300,
      },
    },
    {
      name: "trucrm",
      cwd: "/var/www/trusaas/TruCRM",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 4500,
      },
    },

    // ── 3. UK Region Stack ────────────────────────────────
    {
      name: "trusaas-premium-uk",
      cwd: "/root/truflow-premium-uk",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: 3103,
        MARKET: "uk",
        VALUATION_ENGINE: "package",
      },
    },
    {
      name: "trusaas-inspect-uk",
      cwd: "/root/truinspect-uk",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3102,
        MARKET: "uk",
      },
    },
    {
      name: "trusaas-lens-uk",
      cwd: "/root/TruLens-uk",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3100,
        MARKET: "uk",
      },
    },
    {
      name: "trusaas-mobile-uk",
      cwd: "/root/truflow-mobile-uk",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 3104,
      },
    },
  ],
};
"""

caddyfile = """
# ── TruSaaS Caddyfile (Auto-SSL & Reverse Proxy) ────────────────

# 1. Market Scraper API
scraper.tru-saas.com, truscraper.tru-saas.com, scraper.trusaas.dev {
    reverse_proxy localhost:4300 {
        transport http {
            response_header_timeout 60s
        }
    }
    encode gzip zstd
}

# 2. TruFlow Premium (DMS)
premium.tru-saas.com, premium.trusaas.dev, premium.trudealers.com {
    reverse_proxy localhost:3003
    encode gzip zstd
    request_body {
        max_size 50MB
    }
}

# 3. TruInspect (Condition Reports)
inspect.tru-saas.com, inspect.trusaas.dev, inspect.trudealers.com {
    reverse_proxy localhost:3002
    encode gzip zstd
    request_body {
        max_size 50MB
    }
}

# 4. TruLens (Photo Studio PWA)
lens.tru-saas.com, lens.trusaas.dev, lens.trudealers.com {
    reverse_proxy localhost:3001
    encode gzip zstd
    request_body {
        max_size 50MB
    }
}

# 5. TruFlow Mobile (Companion App)
app.tru-saas.com, app.trusaas.dev, app.trudealers.com {
    reverse_proxy localhost:3004
    encode gzip zstd
}

# 6. TruCRM
crm.tru-saas.com, trucrm.tru-saas.com, crm.trusaas.dev {
    reverse_proxy localhost:4500
    encode gzip zstd
}

# 7. UK Regional Stack
uk-premium.tru-saas.com, uk.premium.tru-saas.com {
    reverse_proxy localhost:3103
    encode gzip zstd
    request_body {
        max_size 50MB
    }
}

uk-inspect.tru-saas.com, uk.inspect.tru-saas.com {
    reverse_proxy localhost:3102
    encode gzip zstd
    request_body {
        max_size 50MB
    }
}

uk-lens.tru-saas.com, uk.lens.tru-saas.com {
    reverse_proxy localhost:3100
    encode gzip zstd
    request_body {
        max_size 50MB
    }
}

uk-app.tru-saas.com, uk.app.tru-saas.com {
    reverse_proxy localhost:3104
    encode gzip zstd
}
"""

sftp = ssh.open_sftp()
with sftp.file("/var/www/trusaas/tools/hetzner/ecosystem.config.cjs", "w") as f:
    f.write(ecosystem)

with sftp.file("/etc/caddy/Caddyfile", "w") as f:
    f.write(caddyfile)

sftp.close()

cmd = "mkdir -p /var/data/trusaas/premium /var/data/trusaas/inspect /var/data/trusaas/lens && pm2 startOrReload /var/www/trusaas/tools/hetzner/ecosystem.config.cjs --update-env && pm2 save && systemctl reload caddy && pm2 status"
stdin, stdout, stderr = ssh.exec_command(cmd)

print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
ssh.close()
