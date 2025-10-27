// lib/auth/tokens.ts
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SECRET = process.env.AUTH_JWT_SECRET!;
if (!SECRET) throw new Error('Missing AUTH_JWT_SECRET');

export type MagicPayload = {
  email: string;
  nonce: string;
  iat?: number; exp?: number;
};

export function makeMagicToken(email: string, ttlSeconds = 15 * 60) {
  const nonce = crypto.randomUUID();
  const token = jwt.sign({ email, nonce } as MagicPayload, SECRET, { expiresIn: ttlSeconds });
  return { token, nonce };
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyMagicToken(token: string): MagicPayload {
  return jwt.verify(token, SECRET) as MagicPayload;
}