// app/api/admin/audit-log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/admin/api-guard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

type AuditLogRow = {
  id: string;
  user_id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_reason: string | null;
  metadata: any;
  created_at: string;
  admin_username: string | null;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdminAPI(req);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const eventType = searchParams.get('event_type');

    let whereClause = '1=1';
    const params: any[] = [];

    if (eventType) {
      params.push(eventType);
      whereClause += ` AND a.event_type = $${params.length}`;
    }

    const { rows } = await query<AuditLogRow>(
      `SELECT 
        a.id::text,
        a.user_id::text,
        a.event_type,
        a.ip_address,
        a.user_agent,
        a.success,
        a.error_reason,
        a.metadata,
        a.created_at::text,
        COALESCE(p.display_name, u.username) as admin_username
      FROM auth_audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN profiles p ON p.user_id = a.user_id
      WHERE ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[GET /api/admin/audit-log]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}