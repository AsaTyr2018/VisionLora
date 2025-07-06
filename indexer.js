const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_PATH = path.join(config.BASE_DIR, 'loradb', 'search_index', 'index.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

class Indexer {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.ensureTables();
  }

  ensureTables() {
    this.db.serialize(() => {
      this.db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS lora_index USING fts5(filename, name, architecture, tags, base_model)`);
      this.db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`);
      this.db.run(`CREATE TABLE IF NOT EXISTS lora_category_map (filename TEXT, category_id INTEGER, UNIQUE(filename, category_id))`);
      this.db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, role TEXT)`);
    });
  }

  addMetadata(data) {
    const stmt = this.db.prepare(`INSERT INTO lora_index(filename, name, architecture, tags, base_model) VALUES(?,?,?,?,?)`);
    stmt.run(data.filename || '', data.title || '', data.architecture || '', data.tags || '', data.base_model || '');
    stmt.finalize();
  }

  loraCount(cb) {
    this.db.get(`SELECT COUNT(*) as cnt FROM lora_index`, (err, row) => cb(row.cnt));
  }

  previewCount() {
    const exts = ['.png', '.jpg', '.jpeg', '.gif'];
    let count = 0;
    if (fs.existsSync(config.UPLOAD_DIR)) {
      for (const file of fs.readdirSync(config.UPLOAD_DIR)) {
        if (exts.includes(path.extname(file).toLowerCase())) count++;
      }
    }
    return count;
  }

  categoryCount(cb) {
    this.db.get(`SELECT COUNT(*) as cnt FROM categories`, (err, row) => cb(row.cnt));
  }

  search(query, cb) {
    let sql = `SELECT filename, name, architecture, tags, base_model FROM lora_index`;
    const params = [];
    if (query && query !== '*') {
      sql += ' WHERE lora_index MATCH ?';
      params.push(query);
    }
    this.db.all(sql, params, cb);
  }

  listCategories(cb) {
    this.db.all(`SELECT id, name FROM categories ORDER BY name`, cb);
  }

  assignCategory(filename, categoryId) {
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO lora_category_map(filename, category_id) VALUES(?,?)`);
    stmt.run(filename, categoryId);
    stmt.finalize();
  }

  unassignCategory(filename, categoryId, cb) {
    this.db.run(
      `DELETE FROM lora_category_map WHERE filename = ? AND category_id = ?`,
      [filename, categoryId],
      cb || (() => {})
    );
  }

  getCategoryIdByName(name, cb) {
    this.db.get(`SELECT id FROM categories WHERE name = ?`, [name], (err, row) => {
      if (err) return cb(err);
      cb(null, row ? row.id : null);
    });
  }

  addCategory(name, cb) {
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO categories(name) VALUES(?)`);
    stmt.run(name, function(err) {
      if (cb) cb(err, this.lastID);
    });
    stmt.finalize();
  }

  deleteCategory(id, cb) {
    this.db.serialize(() => {
      this.db.run(`DELETE FROM categories WHERE id = ?`, [id]);
      this.db.run(`DELETE FROM lora_category_map WHERE category_id = ?`, [id], cb || (() => {}));
    });
  }

  listCategoriesWithCounts(cb) {
    const sql = `SELECT c.id, c.name, COUNT(m.filename) as cnt
                 FROM categories c LEFT JOIN lora_category_map m ON c.id = m.category_id
                 GROUP BY c.id ORDER BY c.name`;
    this.db.all(sql, cb);
  }

  getCategoriesFor(filename, cb) {
    const sql =
      `SELECT c.id, c.name FROM categories c ` +
      `JOIN lora_category_map m ON c.id = m.category_id ` +
      `WHERE m.filename = ? ORDER BY c.name`;
    this.db.all(sql, [filename], cb);
  }

  searchByCategory(categoryId, query, cb) {
    let sql = `SELECT l.filename, l.name, l.architecture, l.tags, l.base_model
               FROM lora_index l JOIN lora_category_map m ON l.filename = m.filename
               WHERE m.category_id = ?`;
    const params = [categoryId];
    if (query && query !== '*') {
      sql += ' AND l MATCH ?';
      params.push(query);
    }
    this.db.all(sql, params, cb);
  }

  removeMetadata(filename, cb) {
    this.db.run(`DELETE FROM lora_index WHERE filename = ?`, [filename], cb || (() => {}));
  }
}

module.exports = new Indexer();
