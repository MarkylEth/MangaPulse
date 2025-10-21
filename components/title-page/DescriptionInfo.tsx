'use client';

import React from 'react';
import Link from 'next/link';
import { STATUS_RU, TR_STATUS_RU, TYPE_RU, toRu } from 'lib/utils';
import type { Manga, Genre, PersonLink, PublisherLink } from './types';

function LinksList<T extends { id:number; name:string; slug?:string|null }>({ list, base }: { list: T[]; base: 'creator'|'publisher' }) {
  if (!list?.length) return <span>—</span>;
  return (
    <>
      {list.map((p, idx) => (
        <span key={`${base}-${p.id}`}>
          {idx > 0 && ', '}
          <Link className="underline underline-offset-2 hover:opacity-80" href={`/${base}/${p.slug ?? String(p.id)}`}>
            {p.name}
          </Link>
        </span>
      ))}
    </>
  );
}

function namesToLinks(raw: string, base: 'creator'|'publisher' = 'creator') {
  const names = String(raw || '').split(/[;,]+/g).map(s => s.trim()).filter(Boolean);
  if (!names.length) return <span>—</span>;
  return (
    <>
      {names.map((n, i) => (
        <span key={`${base}-str-${i}`}>
          {i > 0 && ', '}
          <Link className="underline underline-offset-2 hover:opacity-80" href={`/${base}/${n}`}>
            {n}
          </Link>
        </span>
      ))}
    </>
  );
}

export default function DescriptionInfo({
  manga, rawDesc, authors, artists, publishers, genres, tags,
}: {
  manga: Manga;
  rawDesc: string;
  authors: PersonLink[];
  artists: PersonLink[];
  publishers: PublisherLink[];
  genres: Genre[];
  tags: string[];
}) {
  const [expanded, setExpanded] = React.useState(false);

  const statusHuman = toRu(STATUS_RU, manga.status, 'выпускается');
  const trStatusHuman = toRu(TR_STATUS_RU, manga.translation_status, 'продолжается');
  const typeHuman = toRu(TYPE_RU, manga.type, 'другое');
  const formatsHuman = (manga.release_formats ?? []).filter(Boolean).join(', ');

  const showToggle = React.useMemo(() => {
    const MAX_DESC_LINES = 5;
    const CHAR_LIMIT = 280;
    const descLineCount = (rawDesc ? rawDesc.split(/\r?\n/).filter(l => l.trim().length > 0).length : 0);
    const descCharCount = rawDesc.replace(/\s+/g, ' ').trim().length;
    return (descCharCount > CHAR_LIMIT) || (descLineCount > MAX_DESC_LINES);
  }, [rawDesc]);

  return (
    <div className="rounded-xl bg-card p-6 border border-border">
      <div className="mb-6">
        <h3 className="text-base font-semibold mb-3">Описание</h3>

        <p className={`text-[15px] leading-relaxed text-foreground/90 whitespace-pre-line break-words ${expanded ? '' : 'line-clamp-5'}`}>
          {rawDesc || 'Описание пока отсутствует.'}
        </p>

        {showToggle && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-accent text-sm mt-3 hover:opacity-80 font-medium transition-opacity"
          >
            {expanded ? '↑ Свернуть' : '↓ Показать полностью'}
          </button>
        )}
      </div>

      <div className="border-t border-border my-6" />

      <div className="mb-6">
        <h3 className="text-base font-semibold mb-4">Информация</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Автор</div>
            <div className="font-medium">
              {authors.length
                ? <LinksList list={authors} base="creator" />
                : manga.author ? namesToLinks(manga.author)
                : '—'}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Художник</div>
            <div className="font-medium">
              {artists.length
                ? <LinksList list={artists} base="creator" />
                : manga.artist ? namesToLinks(manga.artist)
                : '—'}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Издатель</div>
            <div className="font-medium">
              {publishers.length ? <LinksList list={publishers} base="publisher" /> : '—'}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Год выпуска</div>
            <div className="font-medium">{manga.release_year || '—'}</div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Возрастной рейтинг</div>
            <div className="font-medium">{manga.age_rating || '—'}</div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Формат выпуска</div>
            <div className="font-medium">{formatsHuman || '—'}</div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Тип</div>
            <div className="font-medium">{typeHuman}</div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Статус тайтла</div>
            <div className="font-medium">{statusHuman}</div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Статус перевода</div>
            <div className="font-medium">{trStatusHuman}</div>
          </div>

          {genres && genres.length > 0 && (
            <div className="col-span-2">
              <div className="text-muted-foreground mb-1.5">Жанры</div>
              <div className="font-medium">
                {genres.map((g, idx) => (
                  <span key={idx}>
                    {idx > 0 && ', '}
                    <span className="font-medium">{g.genre}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {tags && tags.length > 0 && (
            <div className="col-span-2">
              <div className="text-muted-foreground mb-1.5">Теги</div>
              <div className="font-medium">
                {tags.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
