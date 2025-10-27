// app/api/admin/webp-config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI, requireModeratorAPI } from '@/lib/admin/api-guard';
import { logAdminAction } from '@/lib/admin/audit-log';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

interface WebPConfig {
  uploadQuality: number;
  publishQuality: number;
  maxWidth: number;
  maxHeight: number;
  recompressThreshold: number;
  effort: number;
}

const DEFAULT_CONFIG: WebPConfig = {
  uploadQuality: 90,
  publishQuality: 80,
  maxWidth: 1800,
  maxHeight: 2800,
  recompressThreshold: 85,
  effort: 5,
};

// GET - модератор может смотреть
export async function GET(req: NextRequest) {
  try {
    await requireModeratorAPI(req);

    const configResult = await query(
      `SELECT config_value 
       FROM system_config 
       WHERE config_key = 'webp_settings' 
       LIMIT 1`
    ).catch(() => ({ rows: [] }));

    let config = DEFAULT_CONFIG;

    if (configResult.rows.length > 0) {
      try {
        const stored = JSON.parse(configResult.rows[0].config_value);
        config = { ...DEFAULT_CONFIG, ...stored };
      } catch (e) {
        console.error('Failed to parse config:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      config,
      isDefault: configResult.rows.length === 0,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

// POST - только админ может изменять
export async function POST(req: NextRequest) {
  try {
    const { userId: adminId } = await requireAdminAPI(req);

    const body = await req.json().catch(() => null);
    if (!body?.config) {
      return NextResponse.json({ ok: false, error: 'missing_config' }, { status: 400 });
    }

    const { config } = body;

    // Валидация
    const errors = [];

    if (config.uploadQuality < 10 || config.uploadQuality > 100) {
      errors.push('Upload quality must be between 10-100');
    }

    if (config.publishQuality < 10 || config.publishQuality > 100) {
      errors.push('Publish quality must be between 10-100');
    }

    if (config.maxWidth < 800 || config.maxWidth > 4000) {
      errors.push('Max width must be between 800-4000');
    }

    if (config.maxHeight < 1000 || config.maxHeight > 6000) {
      errors.push('Max height must be between 1000-6000');
    }

    if (config.effort < 1 || config.effort > 6) {
      errors.push('Effort must be between 1-6');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, message: 'Validation failed', errors },
        { status: 400 }
      );
    }

    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const configJson = JSON.stringify(finalConfig);

    // Создаем таблицу если не существует
    await query(`
      CREATE TABLE IF NOT EXISTS system_config (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by UUID
      )
    `).catch(() => {});

    // Сохраняем конфиг
    await query(
      `INSERT INTO system_config (config_key, config_value, updated_by)
       VALUES ('webp_settings', $1, $2)
       ON CONFLICT (config_key) 
       DO UPDATE SET 
         config_value = $1,
         updated_at = NOW(),
         updated_by = $2`,
      [configJson, adminId]
    );

    // ✅ Аудит
    await logAdminAction(adminId, 'system_config_change', null, {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0],
      configKey: 'webp_settings',
      newValue: finalConfig
    });

    return NextResponse.json({
      ok: true,
      message: 'WebP configuration updated successfully',
      config: finalConfig,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[POST /api/admin/webp-config]:', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
