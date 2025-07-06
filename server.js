const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const indexer = require('./indexer');
const frontend = require('./frontend');
const auth = require('./auth');
const uploader = require('./uploader');

const upload = multer({ dest: path.join(config.UPLOAD_DIR, '_tmp') });
fs.mkdirSync(path.join(config.UPLOAD_DIR, '_tmp'), { recursive: true });

const app = express();

app.use('/static', express.static(config.STATIC_DIR));
app.use('/uploads', express.static(config.UPLOAD_DIR));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: config.SECRET_KEY, resave: false, saveUninitialized: false }));

// initialize default admin user after DB is ready
indexer.db.serialize(() => {
  auth.createUser('admin', 'admin', 'admin');
});

app.use((req, res, next) => {
  if (!req.session.userId && !req.path.startsWith('/login')) {
    return res.redirect('/login');
  }
  next();
});

app.use((req, res, next) => {
  if (!req.session.userId) return next();
  auth.getUserById(req.session.userId, (err, user) => {
    req.user = user || { username: 'admin', role: 'admin' };
    next();
  });
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
      res.send(frontend.env.render('dashboard.html', { title: 'Dashboard', stats, recent_categories: [], recent_loras: [], user: req.user }));
    });
  });
});

app.get('/grid', (req, res) => {
  const q = req.query.q || '*';
  indexer.search(q, (err, rows) => {
    indexer.listCategories((err2, cats) => {
      res.send(frontend.env.render('grid.html', { title: 'LoRA Gallery', entries: rows, query: q === '*' ? '' : q, categories: cats, selected_category: '', limit: 50, user: req.user }));
    });
  });
});

app.get('/detail/:filename', (req, res) => {
  const filename = req.params.filename;
  const stem = path.parse(filename).name;
  const entry = { filename, name: filename, metadata: {}, categories: [] };
  entry.previews = frontend.findPreviews(stem);
  indexer.getCategoriesFor(filename, (err, cats) => {
    res.send(frontend.env.render('detail.html', { title: filename, entry, categories: cats || [], user: req.user }));
  });
});

app.get('/upload', (req, res) => {
  res.send(frontend.env.render('upload.html', { title: 'Upload', user: req.user }));
});

app.post('/upload', upload.array('files'), (req, res) => {
  const saved = [];
  req.files.forEach(f => {
    const dest = path.join(config.UPLOAD_DIR, f.originalname);
    fs.renameSync(f.path, dest);
    saved.push({ filename: f.originalname });
    indexer.addMetadata({ filename: f.originalname });
  });
  if (req.headers.accept && !req.headers.accept.includes('text/html')) {
    res.json(saved);
  } else {
    res.redirect('/grid');
  }
});

app.get('/upload_wizard', (req, res) => {
  res.send(frontend.env.render('upload_wizard.html', { title: 'Upload Wizard', user: req.user }));
});

app.post('/upload_previews', upload.array('files'), (req, res) => {
  const stem = req.body.lora || '';
  if (req.files.length === 1 && req.files[0].originalname.toLowerCase().endsWith('.zip') && !stem) {
    uploader.savePreviewZip(req.files[0]).then(() => {
      res.json({ status: 'ok' });
    });
    return;
  }
  uploader.savePreviewFiles(stem, req.files).then(() => {
    if (req.headers.accept && !req.headers.accept.includes('text/html')) {
      res.json({ status: 'ok' });
    } else {
      res.redirect('/detail/' + stem + '.safetensors');
    }
  });
});

app.get('/category_admin', (req, res) => {
  indexer.listCategoriesWithCounts((err, cats) => {
    res.send(frontend.env.render('category_admin.html', { title: 'Categories', categories: cats, user: req.user }));
  });
});

app.post('/categories', (req, res) => {
  const name = req.body.name;
  if (!name) return res.redirect('/category_admin');
  indexer.addCategory(name, () => res.redirect('/category_admin'));
});

app.post('/delete_category', (req, res) => {
  indexer.deleteCategory(req.body.category_id, () => res.redirect('/category_admin'));
});

app.get('/admin/users', (req, res) => {
  auth.listUsers((err, users) => {
    res.send(frontend.env.render('user_admin.html', { title: 'Users', users, user: req.user }));
  });
});

app.post('/admin/users/add', (req, res) => {
  const { username, password, role } = req.body;
  auth.createUser(username, password, role);
  res.redirect('/admin/users');
});

app.post('/admin/users/delete', (req, res) => {
  auth.deleteUser(req.body.username);
  res.redirect('/admin/users');
});

app.get('/showcase', (req, res) => {
  indexer.search('*', (err, rows) => {
    const entries = rows.map(r => {
      const stem = path.parse(r.filename).name;
      const previews = frontend.findPreviews(stem);
      return { filename: r.filename, name: r.name || r.filename, preview_url: previews[0] };
    });
    res.send(frontend.env.render('showcase.html', { title: 'Model Showcase', entries, user: req.user }));
  });
});

app.get('/showcase_detail/:filename', (req, res) => {
  const filename = req.params.filename;
  const stem = path.parse(filename).name;
  const entry = { filename, name: filename, previews: frontend.findPreviews(stem) };
  res.send(frontend.env.render('showcase_detail.html', { title: filename, entry, user: req.user }));
});

app.get('/grid_data', (req, res) => {
  const q = req.query.q || '*';
  const category = req.query.category;
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const cb = rows => {
    const data = rows.map(r => {
      const stem = path.parse(r.filename).name;
      const preview = frontend.findPreviews(stem)[0] || null;
      return { filename: r.filename, name: r.name, preview_url: preview };
    });
    res.json(data);
  };
  if (category) {
    indexer.searchByCategory(parseInt(category, 10), q, cb);
  } else {
    indexer.search(q, (err, rows) => cb(rows.slice(offset, offset + limit)));
  }
});

const HOST = '0.0.0.0';
app.listen(5000, HOST, () => console.log(`Server running on http://${HOST}:5000`));
