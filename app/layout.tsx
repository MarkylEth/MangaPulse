// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';
import { getSessionUser } from '@/lib/auth/session';

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
  const dbUser = await getSessionUser().catch(() => null);

  // ✅ Явно формируем безопасный объект (только whitelisted поля)
  const user = dbUser
    ? {
        id: dbUser.id,
        email: dbUser.email,
        username: dbUser.username,
        display_name: dbUser.display_name ?? null,
        avatar_url: dbUser.avatar_url ?? null,
        role: dbUser.role ?? 'user',
      }
    : null;

  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Providers initialUser={user}>{children}</Providers>
      </body>
    </html>
  );
}
