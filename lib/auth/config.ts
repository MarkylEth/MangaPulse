// lib/auth/config.ts
export const SESSION_COOKIE = process.env.SESSION_COOKIE ?? 'mp_session';
export const SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET ?? 'dev-secret-min-32chars';
export const shouldUseSecure = process.env.NODE_ENV === 'production';

// ✅ Проверка на production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_JWT_SECRET || process.env.SESSION_JWT_SECRET === 'dev-secret-min-32chars') {
    throw new Error('SESSION_JWT_SECRET must be set in production!');
  }
  if (process.env.SESSION_JWT_SECRET.length < 32) {
    throw new Error('SESSION_JWT_SECRET must be at least 32 characters long!');
  }
}