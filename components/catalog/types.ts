// components/catalog/types.ts

export type OneOf<T extends readonly string[]> = T[number]
export type Tri = 0 | 1 | -1
export type Range = { min?: number; max?: number }

export type CatalogSortUI =
  | 'pop' | 'rating' | 'views' | 'date' | 'year' | 'nameAZ' | 'nameZA' | 'chapters'

export type MangaItem = {
  id: string
  title: string
  author: string
  type: string
  genres?: string[]
  tags?: string[]
  year: number
  chapters: number
  rating10: number
  age: '0+' | '12+' | '16+' | '18+'
  titleStatus: 'Онгоинг' | 'Завершён' | 'Пауза'
  translationStatus: 'Продолжается' | 'Завершён' | 'Заброшен'
  format: string[]
  other?: string[]
  my?: string[]
  views: number
  popularity: number
  dateAdded: string
  coverClass: string
  coverUrl?: string
}

export type FiltersState = {
  genresTri: Map<string, Tri>
  tagsTri: Map<string, Tri>
  genreStrict: boolean
  tagStrict: boolean
  type: Set<string>
  age: Set<'0+'|'12+'|'16+'|'18+'>
  titleStatus: Set<'Онгоинг'|'Завершён'|'Пауза'>
  translationStatus: Set<'Продолжается'|'Завершён'|'Заброшен'>
  format: Set<string>
  other: Set<string>
  my: Set<string>
  year: Range
  chapters: Range
  rating10: Range
  search: string
  sort: CatalogSortUI
}

export type FiltersAction =
  | { type: 'cycleTri'; field: 'genresTri' | 'tagsTri'; item: string }
  | { type: 'clearTri'; field: 'genresTri' | 'tagsTri' }
  | { type: 'setStrict'; field: 'genreStrict' | 'tagStrict'; value: boolean }
  | { type: 'toggleMulti'; field: keyof Pick<FiltersState,'type'|'age'|'titleStatus'|'translationStatus'|'format'|'other'|'my'>; value: string }
  | { type: 'setRange'; field: keyof Pick<FiltersState,'year'|'chapters'|'rating10'>; range: Range }
  | { type: 'setSearch'; value: string }
  | { type: 'setSort'; value: FiltersState['sort'] }
  | { type: 'reset' }
