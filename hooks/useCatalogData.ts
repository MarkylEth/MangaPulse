// hooks/useCatalogData.ts
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { MangaItem } from '@/components/catalog/types'
import { normalizeRow } from '@/lib/catalog/normalize'
import { TAGS_FALLBACK } from '@/lib/catalog/constants'

export function useCatalogData(apiUrl: string = '/api/catalog?limit=200') {
  const [items, setItems] = useState<MangaItem[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetch(apiUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      if (json && typeof json === 'object' && 'ok' in json && json.ok === false) {
        throw new Error(json.message || 'API error')
      }

      const rows: any[] =
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json)       ? json :
        Array.isArray(json?.rows) ? json.rows : []

      if (cancelRef.current) return

      const normalized = rows.map(normalizeRow)

      const tagSet = new Set<string>()
      for (const it of normalized) for (const t of (it.tags ?? [])) tagSet.add(t)
      const tagList = Array.from(tagSet).sort((a,b)=>a.localeCompare(b,'ru'))

      setAllTags(tagList.length ? tagList : Array.from(TAGS_FALLBACK))
      setItems(normalized)
    } catch (e:any) {
      if (cancelRef.current) return
      setError(e?.message ?? 'Load error')
      setItems([])
      setAllTags(Array.from(TAGS_FALLBACK))
    } finally {
      if (!cancelRef.current) setLoading(false)
    }
  }, [apiUrl])

  useEffect(() => {
    cancelRef.current = false
    load()
    return () => { cancelRef.current = true }
  }, [load])

  return { items, allTags, loading, error, reload: load }
}
