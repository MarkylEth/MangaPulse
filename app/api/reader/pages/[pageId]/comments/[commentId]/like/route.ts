import type { NextRequest } from 'next/server';
import * as impl from '@/app/api/reader/comments/[commentId]/like/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// просто переиспользуем реализацию на commentId
export const POST   = (req: NextRequest, ctx: { params: { commentId: string } }) => impl.POST(req as any, ctx as any);
export const DELETE = (req: NextRequest, ctx: { params: { commentId: string } }) => impl.DELETE(req as any, ctx as any);
