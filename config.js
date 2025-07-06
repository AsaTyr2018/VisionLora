const path = require('path');

const BASE_DIR = __dirname;
module.exports = {
  BASE_DIR,
  UPLOAD_DIR: path.join(BASE_DIR, 'loradb', 'uploads'),
  STATIC_DIR: path.join(BASE_DIR, 'loradb', 'static'),
  TEMPLATE_DIR: path.join(BASE_DIR, 'loradb', 'templates'),
  SECRET_KEY: 'change_this_secret'
};
