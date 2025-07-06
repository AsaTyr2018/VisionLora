const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const indexer = require('./indexer');
const frontend = require('./frontend');
const auth = require('./auth');

const upload = multer({ dest: path.join(config.UPLOAD_DIR, '_tmp') });
fs.mkdirSync(path.join(config.UPLOAD_DIR, '_tmp'), { recursive: true });

const app = express();

app.use('/static', express.static(config.STATIC_DIR));
app.use('/uploads', express.static(config.UPLOAD_DIR));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: config.SECRET_KEY, resave: false, saveUninitialized: false }));

// simple auth middleware
auth.createUser('admin', 'admin', 'admin');

app.use((req, res, next) => {
  if (!req.session.userId && !req.path.startsWith('/login')) {
    return res.redirect('/login');
  }
  next();
});

app.get('/login', (req, res) => {
  res.send(frontend.env.render('login.html', { title: 'Login' }));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  auth.verifyUser(username, password, ok => {
    if (ok) {
      auth.getUser(username, (err, user) => {
        req.session.userId = user.id;
        res.redirect('/');
      });
    } else {
      res.send(frontend.env.render('login.html', { title: 'Login', error: 'Invalid credentials' }));
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', (req, res) => {
  indexer.loraCount(loraCnt => {
    indexer.categoryCount(catCnt => {
      const stats = { lora_count: loraCnt, preview_count: indexer.previewCount(), category_count: catCnt, storage_volume: 0, top_categories: [] };
      res.send(frontend.env.render('dashboard.html', { title: 'Dashboard', stats, recent_categories: [], recent_loras: [], user: { username: 'admin' } }));
    });
  });
});

app.get('/grid', (req, res) => {
  const q = req.query.q || '*';
  indexer.search(q, (err, rows) => {
    indexer.listCategories((err2, cats) => {
      res.send(frontend.env.render('grid.html', { title: 'LoRA Gallery', entries: rows, query: q === '*' ? '' : q, categories: cats, selected_category: '', limit: 50, user: { username: 'admin' } }));
    });
  });
});

app.get('/detail/:filename', (req, res) => {
  const filename = req.params.filename;
  const stem = path.parse(filename).name;
  const entry = { filename, name: filename, metadata: {}, categories: [] };
  entry.previews = frontend.findPreviews(stem);
  res.send(frontend.env.render('detail.html', { title: filename, entry, categories: [], user: { username: 'admin' } }));
});

app.get('/upload', (req, res) => {
  res.send(frontend.env.render('upload.html', { title: 'Upload', user: { username: 'admin' } }));
});

app.post('/upload', upload.array('files'), (req, res) => {
  const saved = [];
  req.files.forEach(f => {
    const dest = path.join(config.UPLOAD_DIR, f.originalname);
    fs.renameSync(f.path, dest);
    saved.push({ filename: f.originalname });
    indexer.addMetadata({ filename: f.originalname });
  });
  res.redirect('/grid');
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));
