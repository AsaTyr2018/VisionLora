#!/usr/bin/env node
/** Create an initial admin user. */
const auth = require('./auth');

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node usersetup.js <username> <password>');
    process.exit(1);
  }
  const [user, password] = args;
  auth.createUser(user, password, 'admin');
  console.log(`Admin user '${user}' created`);
  if (auth.db && typeof auth.db.close === 'function') {
    auth.db.close();
  }
}

if (require.main === module) {
  main();
}
