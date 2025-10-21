// components/catalog/CatalogSort.tsx
'use client'

import type { FiltersState } from '@/components/catalog/types'

export function CatalogSort({
  value,
  onChange,
}: {
  value: FiltersState['sort']
  onChange: (v: FiltersState['sort']) => void
}) {
  return (
    <div>
      <label className="block text-xs mb-1 text-muted-foreground">Сортировка</label>
      <select
        value={value}
        onChange={(e)=>onChange(e.target.value as FiltersState['sort'])}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <option value="pop">По популярности</option>
        <option value="rating">По рейтингу</option>
        <option value="views">По просмотрам</option>
        <option value="date">По дате добавления</option>
        <option value="year">По году</option>
        <option value="chapters">По количеству глав</option>
        <option value="nameAZ">По названию (А-Я)</option>
        <option value="nameZA">По названию (Я-А)</option>
      </select>
    </div>
  )
}
