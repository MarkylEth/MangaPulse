import { NextResponse } from "next/server";
import { getUserBySession } from "@/lib/auth/service";
import { readSessionCookie } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export async function GET() {
  try {
    const token = await readSessionCookie();
    if (!token) {
      return NextResponse.json({ user: null }, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const user = await getUserBySession(token);
    return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ user: null, error: 'session_lookup_failed' }, { status: 500 });
  }
}

