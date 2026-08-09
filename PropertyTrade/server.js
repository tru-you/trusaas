// Flow Prop — Property Management System for SA rental and sales agencies.
// Agency and agent isolation at every layer.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAuthStore, requireAuth } from './lib/auth.js';
import { rateLimit } from './lib/config.js';
import { extractAgency, scopeToAgency } from './lib/isolation.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import propertyRoutes from './routes/properties.js';
import tenantRoutes from './routes/tenants.js';
import leaseRoutes from './routes/leases.js';
import paymentRoutes from './routes/payments.js';
import buyerRoutes from './routes/buyers.js';
import mandateRoutes from './routes/mandates.js';
import offerRoutes from './routes/offers.js';
import saleRoutes from './routes/sales.js';
import maintenanceRoutes from './routes/maintenance.js';
import agentRoutes from './routes/agents.js';
import agencyRoutes from './routes/agency.js';
import ownerRoutes from './routes/owners.js';
import documentRoutes from './routes/documents.js';
import reportRoutes from './routes/reports.js';
import interestRoutes from './routes/interests.js';
import viewingRoutes from './routes/viewings.js';
import commissionRoutes from './routes/commissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 60 }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure auth store exists on boot
ensureAuthStore(DATA_DIR);

// Auth middleware — skips /api/health and /api/auth/login
app.use(requireAuth(DATA_DIR));

// Agency isolation — every authenticated request gets agencyId injected
app.use(extractAgency);

// Health endpoint (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    product: 'flowprop',
    uptimeSec: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  });
});

// Mount routes — all scoped by agencyId via middleware
app.use(authRoutes(DATA_DIR));
app.use(dashboardRoutes(DATA_DIR));
app.use(propertyRoutes(DATA_DIR));
app.use(tenantRoutes(DATA_DIR));
app.use(leaseRoutes(DATA_DIR));
app.use(paymentRoutes(DATA_DIR));
app.use(buyerRoutes(DATA_DIR));
app.use(mandateRoutes(DATA_DIR));
app.use(offerRoutes(DATA_DIR));
app.use(saleRoutes(DATA_DIR));
app.use(maintenanceRoutes(DATA_DIR));
app.use(agentRoutes(DATA_DIR));
app.use(agencyRoutes(DATA_DIR));
app.use(ownerRoutes(DATA_DIR));
app.use(documentRoutes(DATA_DIR));
app.use(reportRoutes(DATA_DIR));
app.use(interestRoutes(DATA_DIR));
app.use(viewingRoutes(DATA_DIR));
app.use(commissionRoutes(DATA_DIR));

// SPA catch-all — serve index.html for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
server.listen(PORT, () => console.log(`Flow Prop on :${PORT}`));
