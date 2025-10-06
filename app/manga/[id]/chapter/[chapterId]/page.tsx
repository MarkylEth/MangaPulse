// app/manga/[id]/chapter/[chapterId]/page.tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function getOrigin(): Promise<string> {
  // В Next 15+ headers() асинхронный
  const h = await headers();

  const host =
    h.get('x-forwarded-host') ??
    h.get('host') ??
    process.env.VERCEL_URL ?? // на Vercel приходит без протокола
    '';

  const proto = h.get('x-forwarded-proto') ?? 'https';

  if (host) {
    // Если переменная уже с протоколом — вернём как есть
    return host.startsWith('http') ? host : `${proto}://${host}`;
  }

  // Фолбэк — BASE_URL из env, без конечного слэша
  const env = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return env || 'http://localhost:3000';
}

export default async function Page({
  params,
}: {
  params: { id: string; chapterId: string };
}) {
  const origin = await getOrigin();

  const res = await fetch(
    `${origin}/api/chapters/${encodeURIComponent(params.chapterId)}`,
    { cache: 'no-store', next: { revalidate: 0 } }
  );

  if (!res.ok) notFound();

  const data = await res.json().catch(() => null);
  const item = data?.item;
  if (!item) notFound();

  // Берём номер тома/главы из возможных полей API
  const volRaw = item.volume_index ?? item.vol ?? null;
  const chRaw  = item.chapter_number ?? item.chapter ?? null;

  if (volRaw != null && chRaw != null) {
    const vol = Number(volRaw);
    const ch  = String(chRaw);
    redirect(
      `/manga/${encodeURIComponent(params.id)}/v/${vol}/c/${encodeURIComponent(ch)}/p/1`
    );
  }

  notFound();
}
  