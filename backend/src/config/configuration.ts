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
  paytm: {
    merchantId: process.env.PAYTM_MERCHANT_ID ?? '',
    merchantKey: process.env.PAYTM_MERCHANT_KEY ?? '',
    channelId: process.env.PAYTM_CHANNEL_ID ?? 'WEB',
    industryTypeId: process.env.PAYTM_INDUSTRY_TYPE_ID ?? '',
    website: process.env.PAYTM_WEBSITE ?? '',
    requestUrl: process.env.PAYTM_REQUEST_URL ?? '',
    // Where Paytm POSTs the result back to us. Must be a real public HTTPS URL —
    // "na" only works for local exploration; register the real value with Paytm
    // once this backend has a public domain.
    callbackUrl: process.env.PAYTM_CALLBACK_URL ?? '',
    statusUrl: process.env.PAYTM_STATUS_URL ?? '',
    // Fixed, server-side fee catalogue — never trust an amount from the client.
    fees: {
      STAGE1_REGISTRATION: parseInt(process.env.PAYTM_FEE_STAGE1_REGISTRATION ?? '500', 10),
      STAGE3_BOOTCAMP: parseInt(process.env.PAYTM_FEE_STAGE3_BOOTCAMP ?? '3500', 10),
    },
  },
  frontend: {
    // Where we redirect the browser after Paytm's callback resolves.
    // e.g. https://indiamindleague.com/payment/result
    paymentResultUrl: process.env.FRONTEND_PAYMENT_RESULT_URL ?? 'http://localhost:4200/payment/result',
  },
});
