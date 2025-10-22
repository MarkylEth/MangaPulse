// lib/anti-bruteforce.ts
/**
 * ✅ Модуль защиты от брутфорса
 * Использует in-memory хранилище для отслеживания попыток входа
 */

interface AttemptRecord {
  count: number;
  lastAttempt: number;
}

// In-memory хранилище (для production используйте Redis)
const store = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 минут
const BASE_DELAY_MS = 1000; // 1 секунда

/**
 * Создаёт уникальный ключ для комбинации IP + email
 */
export function makeKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`;
}

/**
 * Регистрирует неудачную попытку входа
 * @returns Задержка в миллисекундах (для sleep)
 */
export function registerFail(key: string): number {
  const now = Date.now();
  const record = store.get(key);
  
  // Если записи нет или прошло больше времени блокировки - начать заново
  if (!record || now - record.lastAttempt > LOCKOUT_TIME_MS) {
    store.set(key, { count: 1, lastAttempt: now });
    return BASE_DELAY_MS;
  }
  
  // Увеличить счётчик
  const newCount = record.count + 1;
  store.set(key, { count: newCount, lastAttempt: now });
  
  // Экспоненциальная задержка: 1s, 2s, 4s, 8s, 16s...
  // Максимум 30 секунд
  return Math.min(BASE_DELAY_MS * Math.pow(2, newCount - 1), 30000);
}

/**
 * Сбрасывает счётчик при успешной авторизации
 */
export function resetCounter(key: string): void {
  store.delete(key);
}

/**
 * Проверяет, заблокирован ли ключ
 */
export function isBlocked(key: string): boolean {
  const record = store.get(key);
  if (!record) return false;
  
  const now = Date.now();
  
  // Если прошло больше времени блокировки - разблокировать
  if (now - record.lastAttempt > LOCKOUT_TIME_MS) {
    store.delete(key);
    return false;
  }
  
  // Заблокирован, если больше MAX_ATTEMPTS
  return record.count >= MAX_ATTEMPTS;
}

/**
 * Возвращает количество оставшихся попыток
 */
export function getRemainingAttempts(key: string): number {
  const record = store.get(key);
  if (!record) return MAX_ATTEMPTS;
  
  const now = Date.now();
  
  // Если прошло больше времени блокировки - сбросить
  if (now - record.lastAttempt > LOCKOUT_TIME_MS) {
    store.delete(key);
    return MAX_ATTEMPTS;
  }
  
  return Math.max(0, MAX_ATTEMPTS - record.count);
}

/**
 * Периодическая очистка старых записей (вызывается автоматически)
 */
function cleanup() {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now - record.lastAttempt > LOCKOUT_TIME_MS) {
      store.delete(key);
    }
  }
}

// Запускать очистку каждую минуту
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, 60 * 1000);
}