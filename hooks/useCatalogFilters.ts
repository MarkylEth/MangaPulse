// hooks/useCatalogFilters.ts
import { useReducer } from 'react'
import type { FiltersAction, FiltersState } from '@/components/catalog/types'

export const initialFiltersState: FiltersState = {
  genresTri: new Map(), tagsTri: new Map(), genreStrict: false, tagStrict: false,
  type: new Set(), age: new Set(), titleStatus: new Set(), translationStatus: new Set(),
  format: new Set(), other: new Set(), my: new Set(),
  year: {}, chapters: {}, rating10: {},
  search: '', sort: 'pop'
}

function reducer(state: FiltersState, action: FiltersAction): FiltersState {
  switch (action.type) {
    case 'cycleTri': {
      const m = new Map(state[action.field])
      const prev = m.get(action.item) ?? 0
      const next = prev === 0 ? 1 : prev === 1 ? -1 : 0
      if (next === 0) m.delete(action.item); else m.set(action.item, next as 0|1|-1)
      return { ...state, [action.field]: m }
    }
    case 'clearTri': {
      const m = new Map(state[action.field]); m.clear()
      return { ...state, [action.field]: m }
    }
    case 'setStrict':     return { ...state, [action.field]: action.value }
    case 'toggleMulti': {
      const s = new Set(state[action.field] as Set<string>)
      if (s.has(action.value)) s.delete(action.value); else s.add(action.value)
      return { ...state, [action.field]: s } as FiltersState
    }
    case 'setRange':      return { ...state, [action.field]: { ...state[action.field], ...action.range } }
    case 'setSearch':     return { ...state, search: action.value }
    case 'setSort':       return { ...state, sort: action.value }
    case 'reset':         return initialFiltersState
    default:              return state
  }
}

export function useCatalogFilters() {
  return useReducer(reducer, initialFiltersState)
}
