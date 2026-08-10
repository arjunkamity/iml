export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
  },
  db: {
    server: process.env.DB_SERVER ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '1433', 10),
    name: process.env.DB_NAME ?? 'IndiaMindLeague',
    user: process.env.DB_USER ?? 'iml_app',
    password: process.env.DB_PASSWORD ?? '',
    encrypt: (process.env.DB_ENCRYPT ?? 'true') === 'true',
    trustServerCert: (process.env.DB_TRUST_SERVER_CERT ?? 'true') === 'true',
  },
});
