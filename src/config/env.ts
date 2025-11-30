import dotenv from 'dotenv'

dotenv.config()

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL || '',
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || '',
  REDIS_URL: process.env.REDIS_URL || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  BACKUP_SECRET: process.env.BACKUP_SECRET || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || ''
}
