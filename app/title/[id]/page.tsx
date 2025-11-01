// app/title/[id]/page.tsx
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { cache } from 'react';
import MangaTitlePage from '@/components/title-page/MangaTitlePage';
import { romajiSlug, makeIdSlug } from '@/lib/slug';

const getMangaBundle = cache(async (idOrSlug: string) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieHeader = (await cookies()).toString();

    const res = await fetch(`${baseUrl}/api/manga/${idOrSlug}/bundle`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[SSR] Bundle fetch error:', err);
    return null;
  }
});

export default async function TitlePage({ params }: { params: { id: string } }) {
  const { id } = params;

  const data = await getMangaBundle(id);
  const manga = data?.item;
  if (!manga) notFound();

  // канонический слаг
  const rawTitle = (manga.original_title || manga.title_romaji || manga.title || '').trim();
  const canonical = makeIdSlug(Number(manga.id), romajiSlug(rawTitle));

  // если URL кривой — редиректим ДО рендера
  if (id !== canonical) {
    redirect(`/title/${canonical}`);
  }

  const initialData = {
    manga: manga ?? null,
    chapters: (Array.isArray(data?.chapters) ? data!.chapters : []).map((c: any) => ({
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
      mangaId={Number(manga.id)}
      initialData={initialData}
      isLoggedIn={!!data?.me}
    />
  );
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { id } = params;
  const data = await getMangaBundle(id); // ← dedupe через cache()
  const manga = data?.item;

  if (!manga) return { title: 'Тайтл не найден' };

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
