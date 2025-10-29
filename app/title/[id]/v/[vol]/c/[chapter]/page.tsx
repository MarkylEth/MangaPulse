// app/title/[id]/v/[vol]/c/[chapter]/page.tsx
import ChapterReader from '@/components/reader/ChapterReader';
import ForceReaderDark from '@/components/reader/ForceReaderDark';
import { abs } from '@/lib/abs';

export const dynamic = 'force-dynamic';

type Params = { id: string; vol: string; chapter: string; page?: string };

function normalizeVol(vol: string | undefined) {
  if (vol == null) return 'none';
  const v = String(vol).trim();
  if (!v || v.toLowerCase() === 'undefined' || v.toLowerCase() === 'null') return 'none';
  return v;
}

export default async function Page({ params }: { params: Params }) {
  const vol = normalizeVol(params.vol);

  await fetch(
    abs(`/api/reader/${params.id}/volume/${vol}/chapter/${params.chapter}`),
    { cache: 'no-store' }
  ).catch(() => {});

  return (
    <ForceReaderDark>
      <ChapterReader
        mangaId={params.id}
        vol={vol}
        chapter={params.chapter}
        page={params.page ?? '1'}
      />
    </ForceReaderDark>
  );
}