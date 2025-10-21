import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchLatest(limit: number) {
  const { rows } = await query(
    `
    select
      c.id                         as chapter_id,
      c.manga_id                   as manga_id,
      coalesce(m.title,'')         as manga_title,
      coalesce(c.chapter_number,0) as chapter_number,
      coalesce(c.volume,0)         as volume,
      c.created_at                 as created_at,
      coalesce(m.cover_url,null)   as cover_url
    from chapters c
    join manga m on m.id = c.manga_id
    where
      not exists (
        select 1 from information_schema.columns
        where table_schema='public'
          and table_name='chapters'
          and column_name='status'
      )
      or lower(c.status) = 'published'
    order by c.created_at desc, c.id desc
    limit $1
    `,
    [limit]
  );

  return rows.map((r) => ({
    chapter_id: r.chapter_id,
    manga_id: r.manga_id,
    manga_title: r.manga_title,
    chapter_number: r.chapter_number,
    volume: r.volume,
    created_at: r.created_at,
    cover_url: r.cover_url,
    team_name: null as string | null,
    team_slug: null as string | null,
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 15)));

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (e) {
          console.warn('[SSE] Failed to send data:', e);
        }
      };

      const sendPing = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (e) {
          console.warn('[SSE] Failed to send ping:', e);
        }
      };

      // Начальная настройка SSE
      try {
        controller.enqueue(encoder.encode('retry: 5000\n\n'));
        sendPing();
      } catch (e) {
        console.error('[SSE] Failed to initialize:', e);
        closed = true;
        return;
      }

      let lastJSON = '';

      const tick = async () => {
        if (closed) return;
        
        try {
          const items = await fetchLatest(limit);
          const json = JSON.stringify(items);
          
          if (json !== lastJSON) {
            lastJSON = json;
            send(items);
          } else {
            sendPing();
          }
        } catch (e) {
          console.error('[SSE] Error fetching data:', e);
          if (!closed) {
            controller.enqueue(encoder.encode(`: error ${(e as Error).message ?? 'db'}\n\n`));
          }
        }
      };

      await tick();

      const updateInterval = setInterval(tick, 10_000);
      const heartbeatInterval = setInterval(sendPing, 15_000);

      // Таймаут для автоматического закрытия через 5 минут
      const timeoutId = setTimeout(() => {
        cleanup();
      }, 5 * 60 * 1000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        
        clearInterval(updateInterval);
        clearInterval(heartbeatInterval);
        clearTimeout(timeoutId);
        
        try {
          controller.close();
        } catch (e) {
          console.warn('[SSE] Error closing controller:', e);
        }
        
        console.log('[SSE] Connection closed');
      };

      // Обработка закрытия соединения
      if (req.signal) {
        req.signal.addEventListener('abort', cleanup);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Transfer-Encoding': 'chunked',
    },
  });
}