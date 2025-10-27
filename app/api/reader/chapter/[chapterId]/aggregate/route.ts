import type { NextRequest } from 'next/server';
import * as plural from '@/app/api/reader/chapters/[chapterId]/aggregate/route';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { chapterId: string } }) {
  return plural.GET(req as any, ctx as any);
}

