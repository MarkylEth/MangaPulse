// components/catalog/filters/TagFilter.tsx
'use client'

import { useMemo, useState } from 'react'
import type { Tri } from '@/components/catalog/types'

export function TagFilter({
  items,
  tri,
  strict,
  onCycle,
  onToggleStrict,
  mode,
}: {
  items: string[]
  tri: Map<string, Tri>
  strict: boolean
  onCycle: (item: string) => void
  onToggleStrict: (v: boolean) => void
  mode: 'light'|'dark'
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(
    () => items.filter(i => i.toLowerCase().includes(q.toLowerCase())),
    [items, q]
  )

  const box = (v?: Tri) =>
    `size-4 rounded-sm border flex items-center justify-center text-[10px] leading-none
     ${v===1 ? 'border-emerald-500 bg-emerald-500/30 text-emerald-900 dark:text-emerald-100' :
       v===-1 ? 'border-rose-500 bg-rose-500/30 text-rose-900 dark:text-rose-100' :
       'border-border bg-background'}`
  const holder = "bg-background border border-border text-foreground placeholder:text-muted-foreground/70"

  return (
    <>
      <input
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        placeholder="Фильтр по тегам…"
        className={`w-full rounded-lg px-3 py-2 text-sm mb-3 ${holder}`}
      />

      <label className="flex items-center gap-2 mb-3 select-none">
        <input
          type="checkbox"
          className="accent-current"
          checked={strict}
          onChange={(e)=>onToggleStrict(e.target.checked)}
        />
        <span className="text-foreground">Строгое совпадение</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Пусто → ✓ включить → ✕ исключить</span>
      </label>

      <div className="max-h-72 overflow-auto pr-1 space-y-1">
        {filtered.map((name)=> {
          const state = tri.get(name) ?? 0
          return (
            <button
              key={name}
              onClick={()=>onCycle(name)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition text-left"
            >
              <span className={box(state)}>{state===1?'✓':state===-1?'✕':''}</span>
              <span className="text-foreground flex-1">{name}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
