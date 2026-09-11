import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import http from "http";
import https from "https";
import { URL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3002", 10);
const API_TARGET = process.env.API_TARGET || process.env.TRUFLOW_DMS_URL || "https://premium.tru-saas.com";
const target = new URL(API_TARGET);

const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  next();
});

// Health check (Render monitoring)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "truflow-mobile" });
});

// Proxy /api/* and /media/* to the Premium backend using raw http.
// Vehicle photos are stored as relative "/media/<hash>.jpg" refs, so without
// the /media proxy every image resolves against app.tru-saas.com and 404s.
app.use(["/api", "/media"], (req, res) => {
  const opts = {
    hostname: target.hostname,
    port: target.port,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  };

  const transport = target.protocol === "https:" ? https : http;
  const proxy = transport.request(opts, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res, { end: true });
  });

  proxy.setTimeout(30000, () => {
    proxy.destroy();
    if (!res.headersSent) res.status(504).json({ error: "Backend timeout" });
  });

  proxy.on("error", (err) => {
    console.error("Proxy error:", err.message);
    if (!res.headersSent) res.status(502).json({ error: "Backend unreachable" });
  });

  req.pipe(proxy, { end: true });
});

// Serve static PWA files
app.use(express.static(join(__dirname, "public")));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`TruFlow Mobile → http://localhost:${PORT}`);
  console.log(`API proxy → ${API_TARGET}`);
});
