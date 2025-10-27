// app/api/admin/audit-log/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/admin/api-guard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdminAPI(req);

    // Общее количество
    const { rows: totalRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM auth_audit_log`
    );

    // По типам действий
    const { rows: byTypeRows } = await query<{ event_type: string; count: string }>(
      `SELECT event_type, COUNT(*)::text as count 
       FROM auth_audit_log
       GROUP BY event_type
       ORDER BY count DESC`
    );

    // Топ администраторов
    const { rows: topAdminsRows } = await query<{ 
      user_id: string; 
      username: string | null; 
      count: string;
    }>(
      `SELECT 
        a.user_id::text,
        COALESCE(p.display_name, u.username) as username,
        COUNT(*)::text as count
       FROM auth_audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN profiles p ON p.user_id = a.user_id
       GROUP BY a.user_id, p.display_name, u.username
       ORDER BY count DESC
       LIMIT 10`
    );

    const actionsByType: Record<string, number> = {};
    for (const row of byTypeRows) {
      actionsByType[row.event_type] = parseInt(row.count, 10);
    }

    return NextResponse.json({
      ok: true,
      totalActions: parseInt(totalRows[0]?.count || '0', 10),
      actionsByType,
      topAdmins: topAdminsRows.map(row => ({
        admin_id: row.user_id,
        username: row.username || 'Unknown',
        count: parseInt(row.count, 10)
      }))
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/audit-log/stats]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}