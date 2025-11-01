import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
// настрой под свой клиент/хелпер
const s3 = new S3Client({
  region: 'auto', // R2
  endpoint: process.env.R2_ENDPOINT!, // https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET!;
const PUB_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE || '').replace(/\/$/, '');

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const chapterId = Number(params.id);
    const mangaId = Number(req.nextUrl.searchParams.get('mangaId'));
    if (!Number.isFinite(chapterId) || !Number.isFinite(mangaId)) {
      return NextResponse.json({ ok: false, message: 'Bad params' }, { status: 400 });
    }
    const prefix = `staging/manga/${mangaId}/chapters/${chapterId}/`;
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: 2000 }));
    const items = (r.Contents || [])
      .filter(o => o.Key && /\/p\d{4}\.(webp|jpe?g|png|gif)$/i.test(o.Key))
      .map(o => {
        const m = o.Key!.match(/p(\d{4})\.(\w+)$/i);
        return {
          key: o.Key!,
          index: m ? parseInt(m[1], 10) : 0,
          size: o.Size || 0,
          url: PUB_BASE ? `${PUB_BASE}/${o.Key}` : null,
        };
      })
      .sort((a, b) => a.index - b.index);
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, message: e?.message || 'R2 list error' }, { status: 500 });
  }
}
