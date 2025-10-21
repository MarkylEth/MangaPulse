// components/catalog/filters/RangeFilter.tsx
'use client'

import { useEffect, useState } from 'react'
import type { Range } from '@/components/catalog/types'

export function RangeFilter({
  value, onChange, placeholderMin, placeholderMax, mode
}: {
  value: Range
  onChange: (r: Range) => void
  placeholderMin?: string
  placeholderMax?: string
  mode: 'light'|'dark'
}) {
  const cls = "bg-background border border-border text-foreground placeholder:text-muted-foreground/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"

  const [minText, setMinText] = useState(value.min != null ? String(value.min) : '')
  const [maxText, setMaxText] = useState(value.max != null ? String(value.max) : '')

  useEffect(() => { setMinText(value.min != null ? String(value.min) : '') }, [value.min])
  useEffect(() => { setMaxText(value.max != null ? String(value.max) : '') }, [value.max])

  const re = /^\d*([.]\d*)?$/

  const handleMin = (t: string) => {
    const s = t.replace(',', '.')
    if (!re.test(s)) return setMinText(s)
    setMinText(s)
    if (s === '' || s === '.') return onChange({ min: undefined })
    const n = Number(s)
    if (!Number.isNaN(n)) onChange({ min: n })
  }

  const handleMax = (t: string) => {
    const s = t.replace(',', '.')
    if (!re.test(s)) return setMaxText(s)
    setMaxText(s)
    if (s === '' || s === '.') return onChange({ max: undefined })
    const n = Number(s)
    if (!Number.isNaN(n)) onChange({ max: n })
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <input
        inputMode="decimal"
        step="any"
        pattern="[0-9]*[.,]?[0-9]*"
        className={`${cls} w-full min-w-0`}
        placeholder={placeholderMin ?? 'от'}
        value={minText}
        onChange={(e)=>handleMin(e.target.value)}
      />
      <span className="text-muted-foreground px-1">-</span>
      <input
        inputMode="decimal"
        step="any"
        pattern="[0-9]*[.,]?[0-9]*"
        className={`${cls} w-full min-w-0`}
        placeholder={placeholderMax ?? 'до'}
        value={maxText}
        onChange={(e)=>handleMax(e.target.value)}
      />
    </div>
  )
}
