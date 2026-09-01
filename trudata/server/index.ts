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

// Initialize DB (graceful — works without Firebase for local dev)
import { initDb } from './lib/db';
try { initDb(); } catch { console.warn('[trudata] Running without Firebase — orders will fail. Set GOOGLE_APPLICATION_CREDENTIALS for production.'); }

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files — resolve from project root/public regardless of CWD
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
app.use(express.static(publicDir));

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'trudata', timestamp: new Date().toISOString() });
});

app.use('/api/valuation', valuationRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payfast', payfastRoutes);
app.use('/api/sample', sampleRoutes);

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
