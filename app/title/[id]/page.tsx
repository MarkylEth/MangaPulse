// app/title/[id]/page.tsx (Server Component)
import { cookies } from 'next/headers';
import MangaTitlePage from '@/components/title-page/MangaTitlePage';

async function getMangaBundle(idOrSlug: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const res = await fetch(`${baseUrl}/api/manga/${idOrSlug}/bundle`, {
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[SSR] Bundle fetch error:', err);
    return null;
  }
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // ⚡ ОДИН запрос на сервере
  const data = await getMangaBundle(id);

  const isLoggedIn = !!data?.me;
  const mangaId = Number(data?.item?.id ?? id) || Number(id);

  // ✅ Передаём ВСЕ данные, чтобы клиент не делал запросы
  const initialData = {
    manga: data?.item ?? null,
    chapters: (Array.isArray(data?.chapters) ? data.chapters : []).map((c: any) => ({
      ...c,
      chapter_number: Number(c.chapter_number),
      vol_number: c.vol_number == null ? null : Number(c.vol_number),
    })),
    genres: data?.genres ?? [],
    tags: data?.tags ?? [],
    ratings: data?.ratings ?? [],
    teams: data?.teams ?? [],
    me: data?.me ?? null,
    authors: data?.people?.authors ?? [],
    artists: data?.people?.artists ?? [],
    publishers: data?.publishers ?? [],
    bookmark: data?.bookmark ?? null,
  };

  return (
    <MangaTitlePage
      mangaId={mangaId}
      initialData={initialData}
      isLoggedIn={isLoggedIn}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMangaBundle(id);
  const manga = data?.item;

  if (!manga) {
    return { title: 'Тайтл не найден' };
  }

  return {
    title: manga.title || 'Манга',
    description: manga.description?.slice(0, 160) || '',
    openGraph: {
      title: manga.title,
      description: manga.description?.slice(0, 160),
      images: manga.cover_url ? [manga.cover_url] : [],
    },
  };
}