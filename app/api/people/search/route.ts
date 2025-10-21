import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const role = (url.searchParams.get('role') ?? '').toUpperCase(); // AUTHOR | ARTIST | ''

  const params: any[] = [];
  const where: string[] = [];

  if (q) {
    params.push(`%${q.replace(/[%_]/g, '\\$&')}%`);
    where.push(`(name ILIKE $${params.length} ESCAPE '\\' OR slug ILIKE $${params.length} ESCAPE '\\')`);
  }

  if (role) {
    params.push(role);
    // матч по ЛЮБОЙ из двух колонок: legacy role ИЛИ массив roles[]
    where.push(`(
      role = $${params.length} OR
      $${params.length} = ANY(COALESCE(roles, '{}'::person_role[]))
    )`);
  }

  const sql = `
    SELECT id, name, slug
      FROM people
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY name ASC
     LIMIT 20
  `;
  const r = await query(sql, params);
  return NextResponse.json({ items: r.rows });
}
