export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:4000',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim()),
  redisUrl: process.env.REDIS_URL,
  r2: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  },
  matias: {
    apiUrl: process.env.MATIAS_API_URL,
    apiKey: process.env.MATIAS_API_KEY,
  },
  email: {
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME ?? 'La Oficina Nítida',
    requireReal: process.env.REQUIRE_REAL_EMAIL === 'true',
    smtp: {
      host: process.env.EMAIL_SMTP_HOST,
      port: process.env.EMAIL_SMTP_PORT
        ? parseInt(process.env.EMAIL_SMTP_PORT, 10)
        : undefined,
      user: process.env.EMAIL_SMTP_USER,
      password: process.env.EMAIL_SMTP_PASSWORD,
      secure:
        process.env.EMAIL_SMTP_SECURE === undefined
          ? undefined
          : process.env.EMAIL_SMTP_SECURE === 'true',
      requireTls:
        process.env.EMAIL_SMTP_REQUIRE_TLS === undefined
          ? undefined
          : process.env.EMAIL_SMTP_REQUIRE_TLS === 'true',
    },
  },
});
