// components/catalog/CatalogCard.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { MangaItem } from '@/components/catalog/types'

export function CatalogCard({
  manga,
  mode,
}: {
  manga: MangaItem
  mode: 'light'|'dark'
}) {
  return (
    <article
      className="rounded-2xl overflow-hidden bg-card border border-border/60 shadow-sm
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300
                 flex flex-col"
    >
      <Link href={`/title/${manga.id}`} className="block">
        <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '2 / 3' }}>
          {manga.coverUrl ? (
            <Image
              src={manga.coverUrl}
              alt={manga.title}
              fill
              className="object-cover"
              sizes="(min-width: 1536px) 300px, (min-width: 1280px) 260px, (min-width: 1024px) 25vw, 50vw"
              priority={false}
              quality={85}
              unoptimized
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${manga.coverClass}`} />
          )}

          {/* статус слева сверху */}
          <div className="absolute top-2 left-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium shadow-sm ${
                manga.titleStatus === 'Онгоинг'
                  ? 'bg-emerald-500 text-white'
                  : manga.titleStatus === 'Завершён'
                  ? 'bg-sky-500 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {manga.titleStatus}
            </span>
          </div>

          {/* возраст справа сверху */}
          <AgeBadge age={manga.age} />

          {/* мягкий градиент для читаемости */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        </div>
      </Link>

      {/* контент */}
      <div className="p-4 grid grid-rows-[auto_auto_1.5rem_2.4rem_auto] gap-1.5 flex-1 min-h-0">
        <Link href={`/title/${manga.id}`} className="hover:underline" title={manga.title}>
          <h3 className="font-semibold text-lg leading-snug line-clamp-2 min-h-[3rem]">
            {manga.title}
          </h3>
        </Link>

        <p className="text-muted-foreground text-sm line-clamp-1 min-h-[1.25rem]" title={manga.author}>
          {manga.author}
        </p>

        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs px-2 py-[2px] rounded-full border border-border bg-muted text-foreground/80 shrink-0">
            {manga.translationStatus}
          </span>
          <span className="text-xs px-2 py-[2px] rounded-full border border-border bg-muted text-foreground/80 shrink-0">
            {manga.year}
          </span>
        </div>

        <div className="text-xs text-foreground space-y-1 overflow-hidden">
          <div className="line-clamp-1">
            <span className="text-muted-foreground">Жанры: </span>
            {formatList(manga.genres as string[], 3)}
          </div>
          <div className="line-clamp-1">
            <span className="text-muted-foreground">Теги: </span>
            {formatList(manga.tags, 3)}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <RatingStars rating10={manga.rating10} />
          <Link
            href={`/title/${manga.id}`}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted border border-border hover:opacity-90 transition"
          >
            Читать
          </Link>
        </div>
      </div>
    </article>
  )
}

function RatingStars({ rating10 }: { rating10: number }) {
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => {
        const filled = i < Math.round(rating10 / 2)
        return <span key={i} className={`text-sm ${filled ? 'text-amber-400' : 'text-muted-foreground'}`}>★</span>
      })}
      <span className="text-muted-foreground text-xs ml-1">{rating10.toFixed(1)}</span>
    </div>
  )
}

function AgeBadge({ age }: { age: '0+'|'12+'|'16+'|'18+' }) {
  const palette =
    age === '0+'  ? 'bg-emerald-500 text-white' :
    age === '12+' ? 'bg-sky-500 text-white'     :
    age === '16+' ? 'bg-amber-500 text-white'   :
                    'bg-rose-600 text-white'
  return (
    <div className="absolute top-2 right-2">
      <span className={`px-2 py-1 rounded-full text-xs font-semibold shadow-sm ${palette}`}>{age}</span>
    </div>
  )
}

function formatList(list?: string[] | null, max = 3) {
  const arr = (list ?? []).map(String).filter(Boolean)
  if (!arr.length) return '-'
  const first = arr.slice(0, max).join(', ')
  const rest = arr.length - max
  return rest > 0 ? `${first} +${rest}` : first
}
