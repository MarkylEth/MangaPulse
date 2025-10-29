// app/title/[id]/v/[vol]/c/[chapter]/p/[p]/page.tsx
import ChapterReader from '@/components/reader/ChapterReader';

type Params = {
  id: string;
  vol: string;
  chapter: string;
  p: string;
};

export const dynamic = 'force-dynamic';

function normalizeId(id: string) {
  return id.match(/\d+/)?.[0] ?? id;
}

function normalizeVol(vol: string | undefined) {
  if (vol == null) return 'none';
  const v = String(vol).trim();
  if (!v || v.toLowerCase() === 'undefined' || v.toLowerCase() === 'null') return 'none';
  return v;
}

export default async function Page({ params }: { params: Params }) {
  const mangaId = normalizeId(params.id);
  const vol = normalizeVol(params.vol);
  const page = params.p ?? '1';

  return (
    <ChapterReader
      mangaId={mangaId}
      vol={vol}
      chapter={params.chapter}
      page={page}
    />
  );
}