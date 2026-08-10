/*
 * Dev helper: set a user's password (bcrypt-hashed) by email.
 * Usage:  node scripts/set-password.js <email> <password>
 * Reads DB connection from backend/.env
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sql = require('mssql');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/set-password.js <email> <password>');
    process.exit(1);
  }
  const env = loadEnv();
  const hash = await bcrypt.hash(password, 10);

  const pool = await new sql.ConnectionPool({
    server: env.DB_SERVER || 'localhost',
    port: parseInt(env.DB_PORT || '1433', 10),
    database: env.DB_NAME || 'IndiaMindLeague',
    user: env.DB_USER || 'iml_app',
    password: env.DB_PASSWORD || '',
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();

  const result = await pool
    .request()
    .input('email', email)
    .input('hash', hash)
    .query('UPDATE dbo.Users SET PasswordHash = @hash WHERE Email = @email');

  console.log(`Updated ${result.rowsAffected[0]} user(s) for ${email}`);
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
