// app/api/chapters/stream/route.ts
import { query } from '@/lib/db';

async function fetchLatest(limit: number) {
  const { rows } = await query(
    `
    select c.id as chapter_id,
           c.manga_id,
           coalesce(m.title,'') as manga_title,
           coalesce(c.chapter_number,0) as chapter_number,
           coalesce(c.volume,0) as volume,
           c.created_at,
           coalesce(m.cover_url,null) as cover_url
      from chapters c
      join manga m on m.id = c.manga_id
     where not exists (
            select 1 from information_schema.columns
             where table_schema='public' and table_name='chapters' and column_name='status'
          )
        or lower(c.status) = 'published'
     order by c.created_at desc, c.id desc
     limit $1
    `,
    [15]
  );

  return rows.map((r) => ({
    chapter_id: r.chapter_id,
    manga_id: r.manga_id,
    manga_title: r.manga_title,
    chapter_number: r.chapter_number,
    volume: r.volume,
    created_at: r.created_at,
    cover_url: r.cover_url,
    team_name: null,
    team_slug: null,
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 15)));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: any) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      // hint браузеру + heartbeat
      controller.enqueue(encoder.encode('retry: 10000\n\n'));

      let lastJSON = '';
      const tick = async () => {
        const items = await fetchLatest(limit);
        const json = JSON.stringify(items);
        if (json !== lastJSON) {
          lastJSON = json;
          send(items);
        }
      };

      // первая отправка
      await tick();

      const iv = setInterval(tick, 15000);
      const hb = setInterval(
        () => controller.enqueue(encoder.encode(': ping\n\n')),
        30000
      );

      const close = () => {
        clearInterval(iv);
        clearInterval(hb);
        try { controller.close(); } catch {}
      };

      // закрытие по разрыву
      (req as any).signal?.addEventListener?.('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
