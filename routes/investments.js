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

// GET /api/investments/summary
router.get('/summary', auth, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT category, SUM(amount) AS invested, SUM(current_value) AS current FROM investments WHERE user_id=? GROUP BY category').all(req.user.id);
    const totalInvested = rows.reduce((s, r) => s + r.invested, 0);
    const totalCurrent  = rows.reduce((s, r) => s + r.current,  0);
    const totalReturn   = totalCurrent - totalInvested;
    const returnPct     = totalInvested > 0 ? ((totalReturn / totalInvested) * 100).toFixed(2) : 0;
    res.json({ categories: rows, totalInvested, totalCurrent, totalReturn, returnPct });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/investments/history — portfolio value over time
router.get('/history', auth, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT date, total_value FROM portfolio_history WHERE user_id=? ORDER BY date ASC').all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/investments/all — all individual investment records
router.get('/all', auth, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM investments WHERE user_id=? ORDER BY timestamp DESC').all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/investments/flexible — update user's flexible category instrument
router.patch('/flexible', auth, (req, res) => {
  try {
    const { instrument } = req.body;
    if (!instrument) return res.status(400).json({ error: 'instrument required' });
    const db = getDB();
    db.prepare('UPDATE users SET custom_category=? WHERE id=?').run(instrument, req.user.id);
    db.prepare("UPDATE investments SET instrument=? WHERE user_id=? AND category='flexible'").run(instrument, req.user.id);
    res.json({ success: true, instrument });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
