// app/manga/[id]/v/[vol]/c/[chapter]/page.tsx
import ChapterReader from '@/components/ChapterReader';
import ForceReaderDark from '@/components/ForceReaderDark';
import { abs } from '@/lib/abs';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: { id: string; vol: string; chapter: string; page?: string };
}) {
  // опционально проверяем, что глава существует
  await fetch(
    abs(`/api/reader/${params.id}/volume/${params.vol}/chapter/${params.chapter}`),
    { cache: 'no-store' }
  ).catch(() => { /* можно notFound/redirect */ });

  return (
    <ForceReaderDark>
      <ChapterReader
        mangaId={params.id}
        vol={params.vol}
        chapter={params.chapter}
        page={params.page ?? '1'}
        forceDark
      />
    </ForceReaderDark>
  );
}
