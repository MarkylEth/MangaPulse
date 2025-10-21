import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/route-guards';

function isStaff(u: any): boolean {
  const role = String(u?.role ?? u?.user?.role ?? '').toLowerCase();
  const roles: string[] = Array.isArray(u?.roles ?? u?.user?.roles)
    ? (u?.roles ?? u?.user?.roles).map((x: any) => String(x).toLowerCase())
    : [];
  const flags = {
    admin: Boolean(u?.is_admin ?? u?.user?.is_admin),
    moderator: Boolean(u?.is_moderator ?? u?.user?.is_moderator),
    staff: Boolean(u?.is_staff ?? u?.user?.is_staff),
  };
  return flags.admin || flags.moderator || flags.staff || role === 'admin' || role === 'moderator' || roles.includes('admin') || roles.includes('moderator');
}

export async function GET() {
  try {
    const u: any = await requireUser().catch(() => null);
    return NextResponse.json({ canPost: !!u && isStaff(u) });
  } catch {
    return NextResponse.json({ canPost: false });
  }
}
