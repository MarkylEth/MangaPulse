// app/(admin)/admin/layout.tsx
export const dynamic = 'force-dynamic';
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/guard";
import "@/app/globals.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin(); // Полная JWT + БД проверка
    return <>{children}</>;
  } catch (error) {
    // Если requireAdmin выбросил ошибку - показываем 404
    console.error('[AdminLayout] Access denied:', error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">404 - Страница не найдена</h1>
          <p className="mt-2">Запрашиваемая страница не существует.</p>
        </div>
      </div>
    );
  }
}