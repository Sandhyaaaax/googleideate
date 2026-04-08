const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'payvest_secret_2026';

const ALLOCATION = {
  long_term:   { pct: 0.20, instruments: ['HDFC Bank', 'State Bank of India', 'Infosys', 'TCS'] },
  mid_term:    { pct: 0.10, instruments: ['BPCL', 'Firstsource Solutions', 'Tata Power', 'IRCTC'] },
  sip:         { pct: 0.30, instruments: ['Nippon India Mutual Fund', 'Mirae Asset Large Cap', 'HDFC Flexi Cap'] },
  mutual_fund: { pct: 0.20, instruments: ['Axis Bluechip Fund', 'SBI Small Cap Fund', 'Parag Parikh Flexi Cap'] },
  flexible:    { pct: 0.20, instruments: null },   // user-defined
};

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/payments/send — main payment + auto-invest trigger
router.post('/send', authMiddleware, (req, res) => {
  try {
    const { amount, recipient, type = 'upi', description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    const investAmount = parseFloat((amount * (user.invest_rate / 100)).toFixed(2));
    const txId = uuidv4();

    // Deduct balance
    db.prepare('UPDATE users SET balance=balance-?, total_invested=total_invested+? WHERE id=?')
      .run(amount, investAmount, user.id);

    // Record transaction
    db.prepare(`INSERT INTO transactions (id,user_id,type,amount,invested_amount,recipient,description)
                VALUES (?,?,?,?,?,?,?)`)
      .run(txId, user.id, type, amount, investAmount, recipient || 'unknown', description || '');

    // Auto-invest allocation
    const investResults = [];
    for (const [cat, cfg] of Object.entries(ALLOCATION)) {
      const catAmount = parseFloat((investAmount * cfg.pct).toFixed(2));
      const instrList = cat === 'flexible'
        ? [user.custom_category || 'Gold ETF']
        : cfg.instruments;
      const instrument = instrList[Math.floor(Math.random() * instrList.length)];
      const growthFactor = 1 + (Math.random() * 0.02 - 0.005); // tiny daily fluctuation

      // Check existing investment in category; add to it
      const existing = db.prepare('SELECT id, amount, current_value FROM investments WHERE user_id=? AND category=?').get(user.id, cat);
      if (existing) {
        db.prepare('UPDATE investments SET amount=amount+?, current_value=current_value+? WHERE id=?')
          .run(catAmount, parseFloat((catAmount * growthFactor).toFixed(2)), existing.id);
      } else {
        db.prepare(`INSERT INTO investments (id,user_id,transaction_id,category,amount,current_value,instrument)
                    VALUES (?,?,?,?,?,?,?)`)
          .run(uuidv4(), user.id, txId, cat, catAmount, parseFloat((catAmount * growthFactor).toFixed(2)), instrument);
      }

      investResults.push({ category: cat, amount: catAmount, instrument });
    }

    res.json({
      success: true,
      transaction_id: txId,
      paid: amount,
      invested: investAmount,
      invest_rate: user.invest_rate,
      allocations: investResults,
      new_balance: parseFloat((user.balance - amount).toFixed(2)),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/payments/transactions — list recent transactions
router.get('/transactions', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const db = getDB();
    const txns = db.prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY timestamp DESC LIMIT ?')
      .all(req.user.id, limit);
    res.json(txns);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/payments/balance
router.get('/balance', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT balance, total_invested FROM users WHERE id=?').get(req.user.id);
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
