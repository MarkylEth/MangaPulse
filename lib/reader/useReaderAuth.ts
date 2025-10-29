// lib/reader/useReaderAuth.ts
import { useEffect, useState } from 'react';

function pickUserId(j: any): string | null {
  const cand = j?.userId ?? j?.user_id ?? j?.id ?? j?.user?.id ?? j?.session?.user?.id ?? null;
  return cand != null ? String(cand) : null;
}

export function useReaderAuth() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
        const j = r.ok ? await r.json() : null;
        if (!cancel) setUserId(pickUserId(j));
      } catch {
        if (!cancel) setUserId(null);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return userId;
}