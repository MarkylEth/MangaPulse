// app/layout.tsx
import './globals.css';                 // ← ОБЯЗАТЕЛЬНО: глобальные стили только здесь
import type { Metadata } from 'next';
import Providers from './providers';
import { getAuthUser } from '@/lib/auth/getAuthUser';

// (не обязательно, но полезно, если читаешь куки/сессию)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'MangaPulse',
  description: 'MangaPulse',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser().catch(() => null);

  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Providers initialUser={user}>{children}</Providers>
      </body>
    </html>
  );
}
