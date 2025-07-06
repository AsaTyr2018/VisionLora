const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const config = require('./config');

const DB_PATH = path.join(config.BASE_DIR, 'loradb', 'search_index', 'index.db');

class Auth {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.ensureTable();
  }

  ensureTable() {
    this.db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, role TEXT)`);
  }

  createUser(username, password, role = 'user') {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO users(username, password_hash, role) VALUES(?,?,?)`);
    stmt.run(username, hash, role);
    stmt.finalize();
  }

  verifyUser(username, password, cb) {
    this.db.get(`SELECT password_hash FROM users WHERE username = ?`, [username], (err, row) => {
      if (!row) return cb(false);
      cb(bcrypt.compareSync(password, row.password_hash));
    });
  }

  getUser(username, cb) {
    this.db.get(`SELECT id, username, role FROM users WHERE username = ?`, [username], cb);
  }

  getUserById(id, cb) {
    this.db.get(`SELECT id, username, role FROM users WHERE id = ?`, [id], cb);
  }
}

module.exports = new Auth();
