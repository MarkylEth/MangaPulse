// components/catalog/CatalogGrid.tsx
'use client'

import { memo } from 'react'
import type { MangaItem } from '@/components/catalog/types'
import { CatalogCard } from '@/components/catalog/CatalogCard' // будет в следующем пакете

export const CatalogGrid = memo(function CatalogGrid({
  items,
  mode,
}: {
  items: MangaItem[]
  mode: 'light'|'dark'
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
      {items.map((manga) => (
        <CatalogCard key={manga.id} manga={manga} mode={mode} />
      ))}
    </div>
  )
})
