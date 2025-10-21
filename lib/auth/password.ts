// lib/auth/password.ts
import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export async function hashPassword(raw: string) {
  return bcrypt.hash(raw, ROUNDS);
}

export async function verifyPassword(raw: string, hash: string) {
  if (!hash) return false;
  return bcrypt.compare(raw, hash);
}
