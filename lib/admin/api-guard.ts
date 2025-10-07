import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function ensureAdminAPI() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
