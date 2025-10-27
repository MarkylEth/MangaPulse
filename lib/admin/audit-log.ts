// lib/admin/audit-log.ts
import { query } from '@/lib/db';

/**
 * Типы действий администраторов, которые нужно логировать
 */
export type AdminAction =
  | 'user_ban'
  | 'user_unban'
  | 'user_profile_update'
  | 'role_change'
  | 'reset_password'
  | 'reset_password_link'
  | 'revoke_sessions'
  | 'manga_approve'
  | 'manga_reject'
  | 'chapter_approve'
  | 'chapter_reject'
  | 'comment_delete'
  | 'comment_approve'
  | 'comment_moderation'
  | 'comment_report_accept'
  | 'comment_report_reject'
  | 'comment_report_delete'
  | 'comment_report_pardon'
  | 'system_config_change'
  | 'cache_refresh';

export type AuditLogMetadata = {
  ip?: string;
  userAgent?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  [key: string]: any;
};

const isDev = process.env.NODE_ENV === 'development';

/**
 * Логирование действия администратора
 */
export async function logAdminAction(
  adminUserId: string,
  action: AdminAction,
  targetId: string | null,
  metadata?: AuditLogMetadata
): Promise<void> {
  try {
    await query(
      `INSERT INTO auth_audit_log 
       (user_id, event_type, ip_address, user_agent, success, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        adminUserId,
        action,
        metadata?.ip || null,
        metadata?.userAgent || null,
        true, // success = true
        JSON.stringify({
          target_id: targetId,
          ...metadata
        })
      ]
    );
    
    if (isDev) {
      console.log('[AUDIT]', {
        admin: adminUserId.substring(0, 8) + '...',
        action,
        target: targetId,
        ip: metadata?.ip
      });
    }
  } catch (error) {
    // Логирование не должно ломать основной flow
    console.error('[AUDIT] Failed to log action:', error);
  }
}

/**
 * Получение последних действий администратора
 */
export async function getAdminActions(
  adminUserId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const { rows } = await query(
      `SELECT 
        id,
        event_type as action,
        metadata->>'target_id' as target_id,
        metadata,
        ip_address,
        created_at
       FROM auth_audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [adminUserId, limit]
    );
    
    return rows;
  } catch (error) {
    console.error('[AUDIT] Failed to get admin actions:', error);
    return [];
  }
}

/**
 * Получение действий над конкретным пользователем/объектом
 */
export async function getTargetHistory(
  targetId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const { rows } = await query(
      `SELECT 
        a.id,
        a.user_id as admin_id,
        a.event_type as action,
        a.metadata,
        a.ip_address,
        a.created_at,
        COALESCE(p.display_name, u.username) as admin_username
       FROM auth_audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN profiles p ON p.user_id = a.user_id
       WHERE a.metadata->>'target_id' = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [targetId, limit]
    );
    
    return rows;
  } catch (error) {
    console.error('[AUDIT] Failed to get target history:', error);
    return [];
  }
}

/**
 * Получение статистики по действиям
 */
export async function getAuditStats(
  fromDate?: Date,
  toDate?: Date
): Promise<{
  totalActions: number;
  actionsByType: Record<string, number>;
  topAdmins: Array<{ admin_id: string; username: string; count: number }>;
}> {
  try {
    const dateFilter = fromDate && toDate
      ? `WHERE created_at BETWEEN $1 AND $2`
      : '';
    const params = fromDate && toDate ? [fromDate, toDate] : [];
    
    // Общее количество
    const { rows: totalRows } = await query(
      `SELECT COUNT(*) as count FROM auth_audit_log ${dateFilter}`,
      params
    );
    
    // По типам действий
    const { rows: byTypeRows } = await query(
      `SELECT event_type as action, COUNT(*) as count 
       FROM auth_audit_log ${dateFilter}
       GROUP BY event_type
       ORDER BY count DESC`,
      params
    );
    
    // Топ администраторов
    const { rows: topAdminsRows } = await query(
      `SELECT 
        a.user_id as admin_id,
        COALESCE(p.display_name, u.username) as username,
        COUNT(*) as count
       FROM auth_audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN profiles p ON p.user_id = a.user_id
       ${dateFilter}
       GROUP BY a.user_id, p.display_name, u.username
       ORDER BY count DESC
       LIMIT 10`,
      params
    );
    
    const actionsByType: Record<string, number> = {};
    for (const row of byTypeRows) {
      actionsByType[row.action] = parseInt(row.count);
    }
    
    return {
      totalActions: parseInt(totalRows[0]?.count || '0'),
      actionsByType,
      topAdmins: topAdminsRows.map(row => ({
        admin_id: row.admin_id,
        username: row.username || 'Unknown',
        count: parseInt(row.count)
      }))
    };
  } catch (error) {
    console.error('[AUDIT] Failed to get stats:', error);
    return {
      totalActions: 0,
      actionsByType: {},
      topAdmins: []
    };
  }
}