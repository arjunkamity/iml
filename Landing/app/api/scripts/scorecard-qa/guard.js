// Loaded first by every script here. These scripts WRITE to the database and run the API's admin calls, so
// they refuse to run unless DATABASE_URL points at this machine, and they take the admin login from the
// environment (QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD) so no password is kept in the repo.
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..') + '/';
process.chdir(ROOT);
require(ROOT + 'node_modules/dotenv').config({ path: ROOT + '.env' });
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || '')) {
  console.error('Refusing to run: DATABASE_URL is not a localhost database.');
  process.exit(1);
}
if (!process.env.QA_ADMIN_EMAIL || !process.env.QA_ADMIN_PASSWORD) {
  console.error('Set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD to a local super admin before running.');
  process.exit(1);
}
module.exports = { ROOT };
