// app/api/admin/env/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/admin/api-guard';

export const dynamic = 'force-dynamic';

/**
 * GET: безопасная информация о системном окружении
 * Требует роль admin
 */
export async function GET(req: NextRequest) {
  // ✅ Защита - только админы
  await requireAdminAPI(req);
  
  const safe = {
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    nodeVersion: process.version,
    platform: process.platform,
    
    // Проверки наличия переменных (без раскрытия значений)
    hasDatabase: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL),
    hasR2: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
    hasWasabi: Boolean(process.env.WASABI_ACCESS_KEY_ID),
    hasEmailService: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST),
    
    // Git информация (безопасно)
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    
    // Public переменные (безопасно делиться)
    publicBaseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? null,
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    
    // Режим работы
    nodeEnv: process.env.NODE_ENV,
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    
    // Vercel специфичные
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelRegion: process.env.VERCEL_REGION ?? null,
  };
  
  return NextResponse.json({ 
    ok: true, 
    env: safe 
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}