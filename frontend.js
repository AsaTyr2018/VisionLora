const nunjucks = require('nunjucks');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class Frontend {
  constructor() {
    this.env = nunjucks.configure(config.TEMPLATE_DIR, { autoescape: true });
    this.previewCache = new Map();
  }

  findPreviews(stem) {
    if (this.previewCache.has(stem)) return this.previewCache.get(stem);
    const matches = [];
    const pattern = new RegExp(`^${stem}(?:_[0-9]+)?\\.(png|jpg)$`, 'i');
    if (fs.existsSync(config.UPLOAD_DIR)) {
      for (const f of fs.readdirSync(config.UPLOAD_DIR)) {
        if (pattern.test(f)) matches.push(`/uploads/${f}`);
      }
    }
    this.previewCache.set(stem, matches);
    return matches;
  }

  invalidatePreviewCache(stem) {
    if (!stem) this.previewCache.clear();
    else this.previewCache.delete(stem);
  }
}

module.exports = new Frontend();
