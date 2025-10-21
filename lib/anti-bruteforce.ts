// lib/anti-bruteforce.ts
const storage = new Map<string, { count: number; lastAttempt: number }>();

export function makeKey(ip: string, email: string) {
  return `${ip}:${email.toLowerCase()}`;
}

export function registerFail(key: string): number {
  const entry = storage.get(key) || { count: 0, lastAttempt: 0 };
  entry.count++;
  entry.lastAttempt = Date.now();
  storage.set(key, entry);
  
  // Экспоненциальная задержка: 2^count * 100ms (макс 5 сек)
  return Math.min(Math.pow(2, entry.count) * 100, 5000);
}

export function resetCounter(key: string) {
  storage.delete(key);
}