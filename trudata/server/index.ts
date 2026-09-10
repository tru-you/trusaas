// Load environment variables FIRST — must run before any module that reads process.env at import time
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// Import routes
import valuationRoutes from './routes/valuation';
import ordersRoutes from './routes/orders';
import payfastRoutes from './routes/payfast';
import sampleRoutes from './routes/sample';
import imagin8Routes from './routes/imagin8';
import agencyRoutes from './routes/agency';
import dealerCrmRoutes from './routes/dealer-crm';
import propertyRoutes from './routes/property';
import catalogueRoutes from './routes/catalogue';
import chatRoutes from './routes/chat';
import safepayRoutes from './routes/safepay';
import electronicsRoutes from './routes/electronics';
import extractRoutes from './routes/extract';
import bureauRoutes from './routes/bureau';
import aeoRoutes from './routes/aeo';

// Initialize DB store
import { initDb } from './lib/db';
initDb();

import { initWallets } from './lib/credits';
initWallets();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? ['https://data.tru-saas.com'] : true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (skip in development)
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
}

// Strict rate limiter for expensive endpoints (production only)
const strictLimiter = isProd ? rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }) : (_req: any, _res: any, next: any) => next();

import fs from 'fs';

// Static files — resolve from project root/public regardless of CWD or bundle context
const candidates = [
  path.resolve(__dirname, '..', 'public'),
  path.resolve(__dirname, 'public'),
  path.resolve(process.cwd(), 'public'),
  path.resolve(process.cwd(), 'trudata', 'public')
];
const publicDir = candidates.find(p => fs.existsSync(p)) || path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'trudata', timestamp: new Date().toISOString() });
});

app.use('/api/valuation', strictLimiter, valuationRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payfast', payfastRoutes);
app.use('/api/sample', sampleRoutes);
app.use('/api/imagin8', imagin8Routes);
app.use('/api/agency', strictLimiter, agencyRoutes);
app.use('/api/dealer-crm', strictLimiter, dealerCrmRoutes);
app.use('/api/property', strictLimiter, propertyRoutes);
app.use('/api/catalogue', catalogueRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/safepay', strictLimiter, safepayRoutes);
app.use('/api/electronics', strictLimiter, electronicsRoutes);
app.use('/api/extract', strictLimiter, extractRoutes);
app.use('/api/bureau', strictLimiter, bureauRoutes);
app.use('/api/aeo', strictLimiter, aeoRoutes);

// API 404 handler
app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(publicDir, 'index.html'));
  }
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 [TruData] Server running at http://localhost:${PORT}`);
  console.log(`   Landing page: http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Valuation:    POST http://localhost:${PORT}/api/valuation/quick\n`);
});
