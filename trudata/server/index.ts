import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import routes
import valuationRoutes from './routes/valuation';
import ordersRoutes from './routes/orders';
import payfastRoutes from './routes/payfast';
import sampleRoutes from './routes/sample';
import imagin8Routes from './routes/imagin8';
import agencyRoutes from './routes/agency';
import dealerCrmRoutes from './routes/dealer-crm';

// Initialize DB store
import { initDb } from './lib/db';
initDb();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/valuation', valuationRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payfast', payfastRoutes);
app.use('/api/sample', sampleRoutes);
app.use('/api/imagin8', imagin8Routes);
app.use('/api/agency', agencyRoutes);
app.use('/api/dealer-crm', dealerCrmRoutes);

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(publicDir, 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 [TruData] Server running at http://localhost:${PORT}`);
  console.log(`   Landing page: http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Valuation:    POST http://localhost:${PORT}/api/valuation/quick\n`);
});
