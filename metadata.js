const fs = require('fs');
const path = require('path');

function extractMetadata(filePath, includeTensorKeys = false) {
  const result = { filename: path.basename(filePath) };
  try {
    const fd = fs.openSync(filePath);
    const headerLenBuf = Buffer.alloc(8);
    fs.readSync(fd, headerLenBuf, 0, 8, 0);
    const headerLen = Number(headerLenBuf.readBigUInt64LE());
    const headerBuf = Buffer.alloc(headerLen);
    fs.readSync(fd, headerBuf, 0, headerLen, 8);
    fs.closeSync(fd);
    const header = JSON.parse(headerBuf.toString('utf8'));
    const meta = header.__metadata__ || header.metadata || {};
    Object.assign(result, meta);
    if (includeTensorKeys) {
      const keys = Object.keys(header).filter(k => !k.startsWith('__'));
      result.tensor_keys = keys.join(',');
    }
  } catch (err) {
    result.error = err.message;
  }
  return result;
}

module.exports = { extractMetadata };
