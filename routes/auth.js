const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'payvest_secret_2026';

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, phone, email, password, invest_rate, custom_category } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ error: 'name, phone and password are required' });

    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) return res.status(409).json({ error: 'Phone number already registered' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO users (id,name,phone,email,password_hash,invest_rate,custom_category)
                VALUES (?,?,?,?,?,?,?)`)
      .run(id, name, phone, email || null, hash, invest_rate || 10, custom_category || 'Gold ETF');

    const token = jwt.sign({ id, phone }, JWT_SECRET, { expiresIn: '7d' });
    const user = db.prepare('SELECT id,name,phone,email,invest_rate,balance,total_invested FROM users WHERE id=?').get(id);
    res.status(201).json({ token, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ error: 'phone and password are required' });

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, phone }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me  (protected)
router.get('/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(token, JWT_SECRET);
    const db = getDB();
    const user = db.prepare('SELECT id,name,phone,email,invest_rate,custom_category,balance,total_invested,created_at FROM users WHERE id=?').get(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// PATCH /api/auth/settings  — update invest rate / custom category
router.patch('/settings', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(token, JWT_SECRET);
    const { invest_rate, custom_category } = req.body;
    const db = getDB();
    db.prepare('UPDATE users SET invest_rate=COALESCE(?,invest_rate), custom_category=COALESCE(?,custom_category) WHERE id=?')
      .run(invest_rate ?? null, custom_category ?? null, payload.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
