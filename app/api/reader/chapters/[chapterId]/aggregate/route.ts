import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------- helpers ---------------- */

async function columnExists(table: string, column: string) {
  const sql = `
    select 1
    from information_schema.columns
    where table_schema='public' and table_name=$1 and column_name=$2
    limit 1`;
  const { rowCount } = await query(sql, [table, column]);
  return (rowCount ?? 0) > 0;
}

// существование таблицы
async function tableExists(table: string) {
  const { rowCount } = await query(
    `select 1 from information_schema.tables where table_schema='public' and table_name=$1 limit 1`,
    [table]
  );
  return (rowCount ?? 0) > 0;
}

const ident = (t: string) => (t === 'chapter_pages' ? t : `"${t}"`);
const inParams = (ids: (string|number)[]) => {
  const vals = ids.filter((x) => x !== null && x !== undefined).map((x) => Number(x)).filter(Number.isFinite);
  return Array.from(new Set(vals));
};

/* ---------------- route ---------------- */

export async function GET(req: Request, { params }: { params: { chapterId: string } }) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user'); // опционально
    const chapterId = Number(params.chapterId);
    if (!Number.isFinite(chapterId)) {
      return NextResponse.json({ ok: false, error: 'bad chapter id' }, { status: 400 });
    }

    // ------------ таблицы, поля (двуязычие/варианты) ------------
    const T_PAGES = (await tableExists('chapter_pages')) ? 'chapter_pages'
                   : (await tableExists('страницы_глав')) ? 'страницы_глав'
                   : 'chapter_pages';

    const fkPg = (await columnExists(T_PAGES, 'chapter_id')) ? 'chapter_id'
               : (await columnExists(T_PAGES, 'chapter_id_bigint')) ? 'chapter_id_bigint'
               : 'chapter_id';

    const hasPageId = await columnExists(T_PAGES, 'id');
    const pageIdCol = hasPageId ? 'id' : 'page_id';

    // главы/лайки
    const T_CH = (await tableExists('chapters')) ? 'chapters'
               : (await tableExists('главы')) ? 'главы'
               : 'chapters';
    const hasChapterLikesCount = await columnExists(T_CH, 'likes_count');

    // потенциальные таблицы лайков глав
    const T_CH_VOTES = (await tableExists('chapter_votes')) ? 'chapter_votes'
                       : (await tableExists('chapter_likes')) ? 'chapter_likes'
                       : (await tableExists('лайки_глав')) ? 'лайки_глав'
                       : null;

    // закладки
    const T_BM =
      (await tableExists('reader_bookmarks')) ? 'reader_bookmarks'
      : (await tableExists('chapter_bookmarks')) ? 'chapter_bookmarks'
      : (await tableExists('bookmarks')) ? 'bookmarks'
      : (await tableExists('закладки')) ? 'закладки'
      : null;
    const bmHasPage = T_BM ? await columnExists(T_BM, 'page') : false;

    // комментарии
    const T_PC =
      (await tableExists('page_comments')) ? 'page_comments'
      : (await tableExists('комментарии_страниц')) ? 'комментарии_страниц'
      : 'page_comments';

    const hasPCLikesCount = await columnExists(T_PC, 'likes_count');
    const hasPCIsEdited   = await columnExists(T_PC, 'is_edited');
    const hasPCEditedAt   = await columnExists(T_PC, 'edited_at');
    const hasPCIsPinned   = await columnExists(T_PC, 'is_pinned');
    const hasPCIsTeam     = await columnExists(T_PC, 'is_team_comment');

    // лайки комментов
    const T_PC_L =
      (await tableExists('page_comment_likes')) ? 'page_comment_likes'
      : (await tableExists('лайки_комментариев_страниц')) ? 'лайки_комментариев_страниц'
      : null;

    // пользователи
    const T_USERS =
      (await tableExists('profiles')) ? 'profiles'
      : (await tableExists('users')) ? 'users'
      : (await tableExists('профили')) ? 'профили'
      : null;

    const userNameCol =
      T_USERS && (await columnExists(T_USERS, 'username')) ? 'username'
      : T_USERS && (await columnExists(T_USERS, 'name')) ? 'name'
      : 'username';

    const userAvatarCol =
      T_USERS && (await columnExists(T_USERS, 'avatar_url')) ? 'avatar_url'
      : T_USERS && (await columnExists(T_USERS, 'avatar')) ? 'avatar'
      : 'avatar_url';

    // команды переводчиков
    const T_TEAMS =
      (await tableExists('translator_teams')) ? 'translator_teams'
      : (await tableExists('teams')) ? 'teams'
      : (await tableExists('команды_перевода')) ? 'команды_перевода'
      : null;

    // ------------ список страниц (из query или всё по главе) ------------
    const pagesParam = url.searchParams.get('pages'); // "1,2,3"
    let pageIds: number[] = inParams((pagesParam ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean));

    if (pageIds.length === 0) {
      // берём все id страниц этой главы
      const { rows } = await query(
        `select ${pageIdCol} as id from ${ident(T_PAGES)} where ${fkPg} = $1 order by id`,
        [chapterId]
      );
      pageIds = rows.map((r: any) => Number(r.id)).filter(Number.isFinite);
    }
    if (pageIds.length === 0) {
      return NextResponse.json({
        ok: true,
        chapter: { id: chapterId, likes: 0, likedByMe: false },
        bookmark: { has: false, page: null },
        comments: { byPage: {}, users: {}, teams: {}, likesCount: {}, likedByMe: {} },
      });
    }

    /* ====================== 1) Комментарии по всем страницам ====================== */
    // динамические плейсхолдеры для IN (...)
    const inPlace = pageIds.map((_, i) => `$${i + 2}`).join(',');
    const pcSql = `
      select
        c.id::text,
        c.page_id::bigint,
        c.${fkPg}::bigint as chapter_id,
        c.user_id::text,
        c.parent_id::text,
        c.content,
        c.created_at,
        ${hasPCIsTeam   ? 'coalesce(c.is_team_comment,false) as is_team_comment,' : 'false as is_team_comment,'}
        ${await columnExists(T_PC, 'team_id') ? 'c.team_id::int,' : 'NULL::int as team_id,'}
        ${hasPCIsPinned ? 'coalesce(c.is_pinned,false) as is_pinned,' : 'false as is_pinned,'}
        ${hasPCLikesCount ? 'coalesce(c.likes_count,0)::int as likes_count,' : '0::int as likes_count,'}
        ${hasPCIsEdited ? 'coalesce(c.is_edited,false) as is_edited,' : 'false as is_edited,'}
        ${hasPCEditedAt ? 'c.edited_at' : 'NULL::timestamptz as edited_at'}
      from ${ident(T_PC)} c
      where c.${fkPg} = $1 and c.page_id in (${inPlace})
      order by c.created_at desc, c.id
    `;
    const pcParams: any[] = [chapterId, ...pageIds];
    const { rows: cRows } = await query(pcSql, pcParams);

    // set of ids для users/teams и likedByMe
    const userIds = new Set<string>();
    const teamIds = new Set<number>();
    const commentIds = new Set<string>();
    cRows.forEach((r: any) => {
      if (r.user_id) userIds.add(String(r.user_id));
      if (r.team_id != null) teamIds.add(Number(r.team_id));
      commentIds.add(String(r.id));
    });

    // likedByMe для комментариев (если есть таблица лайков и userId)
    const likedByMeMap: Record<string, boolean> = {};
    if (userId && T_PC_L && commentIds.size > 0) {
      const ids = Array.from(commentIds);
      const likePlace = ids.map((_, i) => `$${i + 3}`).join(',');
      const likeSql = `
        select l.comment_id::text
        from ${ident(T_PC_L)} l
        where l.user_id = $1 and l.comment_id in (${likePlace})
      `;
      const { rows } = await query(likeSql, [userId, ...ids]);
      rows.forEach((r: any) => { likedByMeMap[String(r.comment_id)] = true; });
    }

    // собрать byPage и карту лайков комментов
    const byPage: Record<string, any[]> = {};
    const commentLikesMap: Record<string, number> = {};
    cRows.forEach((r: any) => {
      const pid = String(r.page_id);
      (byPage[pid] ||= []).push({
        id: String(r.id),
        page_id: Number(r.page_id),
        chapter_id: Number(r.chapter_id),
        user_id: r.user_id ? String(r.user_id) : null,
        parent_id: r.parent_id ? String(r.parent_id) : null,
        content: r.content,
        created_at: r.created_at,
        is_team_comment: !!r.is_team_comment,
        team_id: r.team_id == null ? null : Number(r.team_id),
        is_pinned: !!r.is_pinned,
        likes_count: Number(r.likes_count ?? 0),
        is_edited: !!r.is_edited,
        edited_at: r.edited_at ?? null,
      });
      commentLikesMap[String(r.id)] = Number(r.likes_count ?? 0);
    });

    /* ====================== 2) Пользователи и команды словарями ====================== */
    const usersMap: Record<string, { username?: string|null; avatar_url?: string|null }> = {};
    if (T_USERS && userIds.size > 0) {
      const ids = Array.from(userIds);
      const uPlace = ids.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await query(
        `select id::text, ${userNameCol} as username, ${userAvatarCol} as avatar_url from ${ident(T_USERS)} where id in (${uPlace})`,
        ids
      );
      rows.forEach((r: any) => { usersMap[String(r.id)] = { username: r.username ?? null, avatar_url: r.avatar_url ?? null }; });
    }

    const teamsMap: Record<number, { name?: string|null; slug?: string|null; avatar_url?: string|null; verified?: boolean|null }> = {};
    if (T_TEAMS && teamIds.size > 0) {
      const ids = Array.from(teamIds);
      const tPlace = ids.map((_, i) => `$${i + 1}`).join(',');
      const hasSlug = await columnExists(T_TEAMS, 'slug');
      const hasVerified = await columnExists(T_TEAMS, 'verified');
      const { rows } = await query(
        `select id::int, name, ${hasSlug ? 'slug' : 'NULL as slug'}, avatar_url, ${hasVerified ? 'verified' : 'NULL as verified'} from ${ident(T_TEAMS)} where id in (${tPlace})`,
        ids
      );
      rows.forEach((r: any) => {
        teamsMap[Number(r.id)] = {
          name: r.name ?? null,
          slug: r.slug ?? null,
          avatar_url: r.avatar_url ?? null,
          verified: r.verified ?? null,
        };
      });
    }

    /* ====================== 3) Метрики главы (лайки + likedByMe) ====================== */
    let chapterLikes = 0;
    let chapterLikedByMe = false;

    if (hasChapterLikesCount) {
      const { rows } = await query(`select coalesce(likes_count,0)::int as likes from ${ident(T_CH)} where id = $1`, [chapterId]);
      chapterLikes = Number(rows?.[0]?.likes ?? 0);
    } else if (T_CH_VOTES) {
      const { rows } = await query(
        `select count(*)::int as likes from ${ident(T_CH_VOTES)} where chapter_id = $1`,
        [chapterId]
      );
      chapterLikes = Number(rows?.[0]?.likes ?? 0);
    }

    if (userId) {
      if (T_CH_VOTES) {
        const { rowCount } = await query(
          `select 1 from ${ident(T_CH_VOTES)} where chapter_id = $1 and user_id = $2 limit 1`,
          [chapterId, userId]
        );
        chapterLikedByMe = (rowCount ?? 0) > 0;
      } else if (hasChapterLikesCount) {
        // нет явной таблицы лайков — считаем что нельзя узнать likedByMe
        chapterLikedByMe = false;
      }
    }

    /* ====================== 4) Закладка ====================== */
    let bookmark = { has: false, page: null as number | null };
    if (userId && T_BM) {
      // columns: user_id, chapter_id, page?
      const hasBMChapter = await columnExists(T_BM, 'chapter_id');
      const hasBMUser    = await columnExists(T_BM, 'user_id');
      if (hasBMChapter && hasBMUser) {
        const { rows } = await query(
          `select ${bmHasPage ? 'page' : 'NULL as page'} from ${ident(T_BM)} where user_id = $1 and chapter_id = $2 limit 1`,
          [userId, chapterId]
        );
        if (rows?.length) {
          bookmark = { has: true, page: rows[0]?.page == null ? null : Number(rows[0].page) };
        }
      }
    }

    /* ====================== 5) Ответ ====================== */
    return NextResponse.json({
      ok: true,
      chapter: { id: chapterId, likes: chapterLikes, likedByMe: chapterLikedByMe },
      bookmark,
      comments: {
        byPage,
        users: usersMap,
        teams: teamsMap,
        likesCount: commentLikesMap,
        likedByMe: likedByMeMap,
      },
    });
  } catch (e: any) {
    console.error('[api/reader/chapters/:id/aggregate] error:', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 });
  }
}
