// lib/catalog/filters.ts
import { FiltersState, MangaItem, Range } from '@/components/catalog/types'

export function inRange(val: number, r: Range) {
  if (r.min !== undefined && val < r.min) return false
  if (r.max !== undefined && val > r.max) return false
  return true
}

export function triToSets(tri: Map<string, 0|1|-1>) {
  const include = new Set<string>()
  const exclude = new Set<string>()
  tri.forEach((v,k) => { if (v===1) include.add(k); if (v===-1) exclude.add(k) })
  return { include, exclude }
}

export function matchTri(tri: Map<string, 0|1|-1>, values: string[] | undefined, strict: boolean) {
  const vals = values ?? []
  const { include, exclude } = triToSets(tri)
  for (const ex of exclude) if (vals.includes(ex)) return false
  if (include.size === 0) return true
  if (strict) { for (const inc of include) if (!vals.includes(inc)) return false; return true }
  return vals.some(v => include.has(v))
}

/** Применить все фильтры и сортировку (как было в page.tsx) */
export function applyFiltersAndSort(items: MangaItem[], filters: FiltersState): MangaItem[] {
  const arr = items.filter(it => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!(`${it.title} ${it.author}`.toLowerCase().includes(q))) return false
    }
    if (!matchTri(filters.genresTri, it.genres, filters.genreStrict)) return false
    if (!matchTri(filters.tagsTri, it.tags, filters.tagStrict)) return false
    if (filters.type.size && !filters.type.has(it.type)) return false
    if (filters.age.size && !filters.age.has(it.age)) return false
    if (filters.titleStatus.size && !filters.titleStatus.has(it.titleStatus)) return false
    if (filters.translationStatus.size && !filters.translationStatus.has(it.translationStatus)) return false
    if (filters.format.size && !it.format.some(f => filters.format.has(f))) return false
    if (filters.other.size && !it.other?.some(o => filters.other.has(o))) return false
    if (filters.my.size && !it.my?.some(o => filters.my.has(o))) return false
    if (!inRange(it.year, filters.year)) return false
    if (!inRange(it.chapters, filters.chapters)) return false
    if (!inRange(it.rating10, filters.rating10)) return false
    return true
  })

  switch (filters.sort) {
    case 'rating':   arr.sort((a,b)=>b.rating10-a.rating10); break
    case 'views' :   arr.sort((a,b)=>b.views-a.views); break
    case 'date'  :   arr.sort((a,b)=>+new Date(b.dateAdded)-+new Date(a.dateAdded)); break
    case 'year'  :   arr.sort((a,b)=>b.year-a.year); break
    case 'chapters': arr.sort((a,b)=>b.chapters-a.chapters); break
    case 'nameAZ':   arr.sort((a,b)=>a.title.localeCompare(b.title)); break
    case 'nameZA':   arr.sort((a,b)=>b.title.localeCompare(a.title)); break
    default      :   arr.sort((a,b)=>b.popularity-a.popularity)
  }
  return arr
}
