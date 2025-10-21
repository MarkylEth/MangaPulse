// lib/catalog/normalize.ts
import { MangaItem } from '@/components/catalog/types'

function getAny(obj: any, ...paths: string[]) {
  for (const p of paths) {
    const parts = p.split('.')
    let v = obj
    for (const part of parts) v = v?.[part]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return undefined
}

export function resolveCoverUrl(input: any): string | undefined {
  if (!input) return undefined
  if (typeof input === 'string') {
    const s = input.trim()
    if (!s) return undefined
    if (/^https?:\/\//i.test(s)) return s
    const byColon = s.split(':')
    const bySlash = s.split('/')
    let bucket: string | undefined
    let path: string | undefined
    if (byColon.length === 2) { bucket = byColon[0]; path = byColon[1] }
    else if (bySlash && bySlash[1]) { bucket = bySlash[0]; path = bySlash.slice(1).join('/') }
    if (bucket && path) {
      const base = (process?.env?.NEXT_PUBLIC_WASABI_PUBLIC_BASE_URL || '').replace(/\/$/, '')
      if (base) return `${base}/${bucket}/${path}`
      return `https://${bucket}.s3.wasabisys.com/${path}`
    }
    return undefined
  }
  if (typeof input === 'object') {
    if (typeof (input as any).url === 'string') return resolveCoverUrl((input as any).url)
    if (typeof (input as any).href === 'string') return resolveCoverUrl((input as any).href)
    if (typeof (input as any).path === 'string') {
      const bucket = (input as any).bucket || (input as any).bucketName
      if (bucket) {
        const base = (process?.env?.NEXT_PUBLIC_WASABI_PUBLIC_BASE_URL || '').replace(/\/$/, '')
        const p = String((input as any).path)
        if (base) return `${base}/${bucket}/${p}`
        return `https://${bucket}.s3.wasabisys.com/${p}`
      }
      return resolveCoverUrl((input as any).path)
    }
  }
  return undefined
}

function fallbackGradient(seed: string) {
  const gradients = [
    'from-blue-500 to-blue-600',
    'from-orange-500 to-red-500',
    'from-purple-500 to-purple-600',
    'from-teal-500 to-cyan-500',
    'from-slate-600 to-slate-700',
    'from-red-500 to-pink-500'
  ]
  let h = 0
  for (let i=0; i<seed.length; i++) h = (h*31 + seed.charCodeAt(i)) >>> 0
  return gradients[h % gradients.length]
}

function asStrArray(x: any): string[] | undefined {
  if (x == null) return undefined
  if (Array.isArray(x)) return x.map(String)
  if (typeof x === 'string') {
    try {
      const mayJson = JSON.parse(x)
      if (Array.isArray(mayJson)) return mayJson.map(String)
    } catch {}
    return x.split(',').map(s => s.trim()).filter(Boolean)
  }
  return [String(x)]
}

function mapTitleStatus(v: any): MangaItem['titleStatus'] {
  const s = String(v ?? '').toLowerCase()
  if (['ongoing','онгоинг','выпускается','продолжается'].includes(s)) return 'Онгоинг'
  if (['completed','завершен','завершён','завершено','end'].includes(s)) return 'Завершён'
  if (['paused','пауза','hiatus'].includes(s)) return 'Пауза'
  return 'Онгоинг'
}
function mapTranslationStatus(v: any): MangaItem['translationStatus'] {
  const s = String(v ?? '').toLowerCase()
  if (['ongoing','продолжается'].includes(s)) return 'Продолжается'
  if (['completed','завершен','завершён','завершено'].includes(s)) return 'Завершён'
  if (['dropped','abandoned','заброшен','заброшено'].includes(s)) return 'Заброшен'
  return 'Продолжается'
}
function mapType(v: any): MangaItem['type'] {
  const s = String(v ?? '').toLowerCase()
  if (['манхва','manhwa'].includes(s)) return 'Манхва'
  if (['маньхуа','manhua'].includes(s)) return 'Маньхуа'
  return 'Манга'
}
function mapAge(v: any): MangaItem['age'] {
  const s = String(v ?? '').replace(/\s/g,'')
  if (['0+','0'].includes(s)) return '0+'
  if (['12+','12'].includes(s)) return '12+'
  if (['16+','16'].includes(s)) return '16+'
  if (['18+','18'].includes(s)) return '18+'
  return '12+'
}

/** Нормализация одной строки из API/БД в MangaItem */
export function normalizeRow(row: any): MangaItem {
  const releaseYear = Number(
    getAny(row, 'release_year', 'year', 'manga.release_year', 'manga.year')
  )
  const year = Number.isFinite(releaseYear) && releaseYear > 0
    ? releaseYear
    : (getAny(row, 'release_date', 'manga.release_date')
        ? new Date(getAny(row, 'release_date', 'manga.release_date')).getFullYear()
        : new Date(getAny(row, 'date_added','created_at','manga.date_added','manga.created_at') ?? Date.now()).getFullYear())

  const rating10 =
    typeof row.rating10 === 'number' ? row.rating10 :
    typeof row.rating === 'number'   ? Math.max(0, Math.min(10, row.rating * (row.rating <= 5 ? 2 : 1))) :
    0

  const ageRaw = getAny(
    row,
    'age','age_rating','ageRating',
    'manga.age','manga.age_rating','manga.ageRating'
  )
  const coverUrl = resolveCoverUrl(getAny(
    row,
    'cover_url','cover','image','poster','thumbnail',
    'manga.cover_url','manga.cover','manga.image','manga.poster','manga.thumbnail'
  ))

  return {
    id: String(getAny(row, 'id', 'manga.id')),
    title: String(getAny(row, 'title', 'manga.title') ?? 'Без названия'),
    author: String(getAny(row, 'author','artist','manga.author','manga.artist') ?? 'Неизвестный автор'),
    type: mapType(getAny(row, 'type','kind','manga.type','manga.kind')),
    genres: asStrArray(getAny(row, 'genres','manga.genres')) as any,
    tags: asStrArray(getAny(row, 'tags','manga.tags')) as any,
    year,
    chapters: Number(getAny(row, 'chapters','chapters_count','manga.chapters','manga.chapters_count') ?? 0),
    rating10,
    age: mapAge(ageRaw),
    titleStatus: mapTitleStatus(getAny(row, 'title_status','status','manga.title_status','manga.status')),
    translationStatus: mapTranslationStatus(getAny(row, 'translation_status','manga.translation_status')),
    format: (asStrArray(getAny(row, 'format','manga.format')) ?? ['Веб']) as any,
    other: asStrArray(getAny(row, 'other','manga.other')) as any,
    my: asStrArray(getAny(row, 'my','manga.my')) as any,
    views: Number(getAny(row, 'views','view_count','manga.views','manga.view_count') ?? 0),
    popularity: Number(getAny(row, 'popularity','views','view_count','manga.popularity','manga.views','manga.view_count') ?? 0),
    dateAdded: String(getAny(row, 'date_added','created_at','manga.date_added','manga.created_at') ?? new Date().toISOString()),
    coverClass: String(getAny(row, 'cover_class','manga.cover_class') ?? fallbackGradient(String(getAny(row, 'id','manga.id') ?? '0'))),
    coverUrl
  }
}
