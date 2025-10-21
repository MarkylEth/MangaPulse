// lib/db.ts
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  // чтобы HMR в dev не плодил пулы
  // eslint-disable-next-line no-var
  var __mp_pg_pool__: Pool | undefined;
}

const connectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL/NEON_DATABASE_URL is not set');
}

const pool =
  global.__mp_pg_pool__ ||
  new Pool({
    connectionString,
    ssl: /sslmode=require/i.test(connectionString) ? true : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: false,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__mp_pg_pool__ = pool;
}

// ====== Базовые утилиты PG ======

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export { pool };

/**
 * Tagged template helper:
 *
 * const rows = await sql<{ id:number }>`select id from manga where title ilike ${'%naruto%'};`;
 * // rows: {id:number}[]
 */
export async function sql<T extends QueryResultRow = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
    ''
  );
  const res = await query<T>(text, values);
  return res.rows;
}

/** Обёртка транзакции */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====== Новые функции для RLS ======

/**
 * Query с контекстом пользователя (для RLS)
 * Устанавливает app.current_user_id для политик безопасности
 */
export async function queryAsUser<T extends QueryResultRow = any>(
  text: string,
  params: any[],
  userId: string
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Экранируем userId через параметр для безопасности
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    const result = await client.query<T>(text, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database query error (with user context):', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Транзакция с контекстом пользователя
 */
export async function withTransactionAsUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error (with user context):', error);
    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================================
 * many / one — универсальные нормализаторы результата.
 * Работают с:
 *  - текстовым SQL + params (выполняют query)
 *  - Promise<T[]> (например, из sql`...`)
 *  - T[] (уже готовый массив)
 *  - { rows: T[] } (pg QueryResult)
 * ========================================================================= */

type RowsLike<T extends QueryResultRow> =
  | Promise<T[]>
  | T[]
  | { rows: T[] }
  | string;

/** Вернёт массив строк (выполнит запрос при необходимости) */
export async function many<T extends QueryResultRow = QueryResultRow>(
  input: RowsLike<T>,
  params?: any[]
): Promise<T[]> {
  // строка SQL → выполнить
  if (typeof input === 'string') {
    const res = await query<T>(input, params);
    return res.rows as T[];
  }

  // дождаться промиса, если он есть
  const awaited: any = await Promise.resolve(input as any);

  // массив строк
  if (Array.isArray(awaited)) return awaited as T[];

  // объект с полем rows (QueryResult)
  if (awaited && typeof awaited === 'object' && Array.isArray(awaited.rows)) {
    return awaited.rows as T[];
  }

  return [] as T[];
}

/** Вернёт первую строку или null */
export async function one<T extends QueryResultRow = QueryResultRow>(
  input: RowsLike<T>,
  params?: any[]
): Promise<T | null> {
  const rows = await many<T>(input as any, params);
  return rows.length ? (rows[0] as T) : null;
}

/**
 * many с контекстом пользователя
 */
export async function manyAsUser<T extends QueryResultRow = QueryResultRow>(
  input: string,
  params: any[],
  userId: string
): Promise<T[]> {
  const res = await queryAsUser<T>(input, params, userId);
  return res.rows as T[];
}

/**
 * one с контекстом пользователя
 */
export async function oneAsUser<T extends QueryResultRow = QueryResultRow>(
  input: string,
  params: any[],
  userId: string
): Promise<T | null> {
  const rows = await manyAsUser<T>(input, params, userId);
  return rows.length ? (rows[0] as T) : null;
}