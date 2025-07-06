const bcrypt = require('bcryptjs');
const indexer = require('./indexer');

class Auth {
  constructor() {
    this.db = indexer.db;
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
