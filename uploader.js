const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const config = require('./config');

class Uploader {
  constructor() {
    fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  }

  saveFile(file) {
    const dest = path.join(config.UPLOAD_DIR, file.originalname);
    fs.renameSync(file.path, dest);
    return dest;
  }

  async saveFiles(files) {
    return files.map(f => this.saveFile(f));
  }

  async savePreviewZip(zipFile) {
    const stem = path.parse(zipFile.originalname).name;
    const temp = path.join(config.UPLOAD_DIR, zipFile.filename);
    fs.renameSync(zipFile.path, temp);
    const extracted = [];
    await fs.createReadStream(temp)
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        if (entry.type === 'File') {
          const ext = path.extname(entry.path).toLowerCase();
          if(['.png','.jpg','.jpeg','.gif'].includes(ext)) {
            const index = extracted.length;
            const destName = index === 0 ? `${stem}${ext}` : `${stem}_${index}${ext}`;
            const destPath = path.join(config.UPLOAD_DIR, destName);
            entry.pipe(fs.createWriteStream(destPath));
            extracted.push(destPath);
          } else {
            entry.autodrain();
          }
        } else {
          entry.autodrain();
        }
      })
      .promise();
    fs.unlinkSync(temp);
    return extracted;
  }
}

module.exports = new Uploader();
