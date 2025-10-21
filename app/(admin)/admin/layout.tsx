// app/(admin)/admin/layout.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/guard";
import "@/app/globals.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin(); // редирект/throw если не admin
  return <>{children}</>;
}
