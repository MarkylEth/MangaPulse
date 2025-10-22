//app\providers.tsx
'use client';

import { ThemeProvider } from '@/lib/theme/context';
import { AuthProvider } from '@/components/auth/AuthProvider'; // именованный экспорт
import type { AuthUser } from '@/lib/auth/session'     // <- берём тип отсюда

export default function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  return (
    <ThemeProvider>
      <AuthProvider initialUser={initialUser}>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
