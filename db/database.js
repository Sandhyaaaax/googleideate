const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'payvest.db');
let db;

function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      invest_rate REAL DEFAULT 10,
      custom_category TEXT DEFAULT 'Gold ETF',
      balance REAL DEFAULT 50000,
      total_invested REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      invested_amount REAL NOT NULL,
      recipient TEXT,
      description TEXT,
      status TEXT DEFAULT 'success',
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      transaction_id TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      current_value REAL NOT NULL,
      instrument TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS portfolio_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      total_value REAL NOT NULL,
      date TEXT DEFAULT (date('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Seed demo user if not exists
  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get('9999999999');
  if (!exists) {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();
    const hash = bcrypt.hashSync('1234', 10);
    db.prepare(`INSERT INTO users (id,name,phone,email,password_hash,invest_rate,balance,total_invested)
                VALUES (?,?,?,?,?,?,?,?)`)
      .run(userId, 'Rahul Sharma', '9999999999', 'rahul@payvest.in', hash, 10, 85420, 24680);

    // Seed demo investments
    const categories = [
      { cat: 'long_term',    instrument: 'HDFC Bank',         pct: 0.20, base: 4936 },
      { cat: 'mid_term',     instrument: 'BPCL',              pct: 0.10, base: 2468 },
      { cat: 'sip',          instrument: 'Nippon India MF',   pct: 0.30, base: 7404 },
      { cat: 'mutual_fund',  instrument: 'Axis Bluechip Fund',pct: 0.20, base: 4936 },
      { cat: 'flexible',     instrument: 'Gold ETF',          pct: 0.20, base: 4936 },
    ];
    const invStmt = db.prepare(`INSERT INTO investments (id,user_id,category,amount,current_value,instrument)
                                VALUES (?,?,?,?,?,?)`);
    for (const c of categories) {
      const growth = 1 + (Math.random() * 0.25);
      invStmt.run(uuidv4(), userId, c.cat, c.base, parseFloat((c.base * growth).toFixed(2)), c.instrument);
    }

    // Seed demo transactions
    const txStmt = db.prepare(`INSERT INTO transactions (id,user_id,type,amount,invested_amount,recipient,description,timestamp)
                               VALUES (?,?,?,?,?,?,?,?)`);
    const txSeed = [
      { type:'upi',      amount:1500, recip:'merchant@upi',   desc:'Swiggy Order',        days:1 },
      { type:'recharge', amount:299,  recip:'Airtel',         desc:'Mobile Recharge',      days:2 },
      { type:'bill',     amount:2300, recip:'BESCOM',         desc:'Electricity Bill',     days:3 },
      { type:'upi',      amount:800,  recip:'friend@upi',     desc:'Split Bill',           days:4 },
      { type:'upi',      amount:5000, recip:'amazon@upi',     desc:'Amazon Purchase',      days:6 },
    ];
    for (const t of txSeed) {
      const invested = parseFloat((t.amount * 0.10).toFixed(2));
      const ts = new Date(Date.now() - t.days * 86400000).toISOString();
      txStmt.run(uuidv4(), userId, t.type, t.amount, invested, t.recip, t.desc, ts);
    }

    // Seed portfolio history (last 30 days)
    const histStmt = db.prepare(`INSERT INTO portfolio_history (user_id, total_value, date) VALUES (?,?,?)`);
    let val = 20000;
    for (let i = 30; i >= 0; i--) {
      val += (Math.random() - 0.3) * 400;
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      histStmt.run(userId, parseFloat(val.toFixed(2)), d);
    }
  }

  console.log('✅  Database initialised at', DB_PATH);
  return db;
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { initDB, getDB };
