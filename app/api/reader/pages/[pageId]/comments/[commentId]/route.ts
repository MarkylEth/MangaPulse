import type { NextRequest } from 'next/server';
import * as impl from '@/app/api/reader/comments/[commentId]/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH  = (req: NextRequest, ctx: { params: { commentId: string } }) => impl.PATCH(req as any, ctx as any);
export const DELETE = (req: NextRequest, ctx: { params: { commentId: string } }) => impl.DELETE(req as any, ctx as any);
