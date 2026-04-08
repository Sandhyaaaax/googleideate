const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const investmentRoutes = require('./routes/investments');
const portfolioRoutes = require('./routes/portfolio');
const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Init Database ──
initDB();

// ── API Routes ──
app.use('/api/auth',       authRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/investments',investmentRoutes);
app.use('/api/portfolio',  portfolioRoutes);

// ── Serve frontend pages ──
app.get('/',              (_, res) => res.sendFile(path.join(__dirname, 'landingpage.html')));
app.get('/dashboard',     (_, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/payments',      (_, res) => res.sendFile(path.join(__dirname, 'payments.html')));
app.get('/investments',   (_, res) => res.sendFile(path.join(__dirname, 'investments.html')));
app.get('/portfolio',     (_, res) => res.sendFile(path.join(__dirname, 'portfolio.html')));

// ── Health check ──
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n🚀  PayVest server running at http://localhost:${PORT}`);
  console.log(`📊  Dashboard   → http://localhost:${PORT}/dashboard`);
  console.log(`💸  Payments    → http://localhost:${PORT}/payments`);
  console.log(`📈  Investments → http://localhost:${PORT}/investments\n`);
});
