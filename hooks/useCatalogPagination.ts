// hooks/useCatalogPagination.ts
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MangaItem } from '@/components/catalog/types'

export function useCatalogPagination(data: MangaItem[], pageSize = 24) {
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [data])

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [totalPages, page])

  const start = (page - 1) * pageSize
  const pageData = useMemo(() => data.slice(start, start + pageSize), [data, start, pageSize])

  return {
    page,
    setPage,
    pageSize,
    totalPages,
    totalItems: data.length,
    pageData,
  }
}
