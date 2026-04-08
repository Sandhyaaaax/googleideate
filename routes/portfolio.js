const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'payvest_secret_2026';

function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// GET /api/portfolio/overview
router.get('/overview', auth, (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT name,phone,email,invest_rate,custom_category,balance,total_invested FROM users WHERE id=?').get(req.user.id);
    const investments = db.prepare('SELECT category,instrument,SUM(amount) as invested,SUM(current_value) as current_value FROM investments WHERE user_id=? GROUP BY category').all(req.user.id);
    const txCount = db.prepare('SELECT COUNT(*) as cnt FROM transactions WHERE user_id=?').get(req.user.id).cnt;
    const lastTx  = db.prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY timestamp DESC LIMIT 5').all(req.user.id);
    
    const totalCurrent  = investments.reduce((s, i) => s + i.current_value, 0);
    const totalInvested = investments.reduce((s, i) => s + i.invested, 0);
    const totalReturn   = totalCurrent - totalInvested;
    const returnPct     = totalInvested > 0 ? +((totalReturn / totalInvested) * 100).toFixed(2) : 0;

    res.json({
      user,
      investments,
      totalCurrent: +totalCurrent.toFixed(2),
      totalInvested: +totalInvested.toFixed(2),
      totalReturn: +totalReturn.toFixed(2),
      returnPct,
      txCount,
      lastTransactions: lastTx,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/portfolio/history?days=30
router.get('/history', auth, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const db = getDB();
    const rows = db.prepare(`
      SELECT date, total_value FROM portfolio_history
      WHERE user_id=? AND date >= date('now',?)
      ORDER BY date ASC
    `).all(req.user.id, `-${days} days`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
