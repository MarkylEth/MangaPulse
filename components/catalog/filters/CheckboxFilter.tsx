// components/catalog/filters/CheckboxFilter.tsx
'use client'

import { memo } from 'react'

export const CheckboxFilter = memo(function CheckboxFilter<T extends string>({
  items, selected, onToggle, columns = 3
}: {
  items: readonly T[] | T[]
  selected: Set<T> | undefined
  onToggle: (val: T) => void
  columns?: 1|2|3|4
}) {
  const colsClass = columns === 1 ? 'grid-cols-1'
                  : columns === 2 ? 'grid-cols-2'
                  : columns === 3 ? 'grid-cols-3'
                  : 'grid-cols-4'

  // Создаем пустой Set если selected undefined
  const safeSelected = selected || new Set<T>()

  return (
    <div className={`grid ${colsClass} gap-2`}>
      {items.map((it) => {
        const checked = safeSelected.has(it)
        return (
          <label key={it} className="flex items-center gap-2 cursor-pointer select-none hover:opacity-80 transition-opacity">
            <input 
              type="checkbox" 
              checked={checked} 
              onChange={() => onToggle(it)} 
              className="sr-only" 
            />
            <span
              className={`relative size-4 rounded-md flex items-center justify-center transition-all duration-200
                ${checked 
                  ? 'bg-gradient-to-br from-accent to-accent/80 shadow-sm' 
                  : 'bg-background border-2 border-border/60 hover:border-accent/60'}`}
            >
              {checked && (
                <span className="absolute inset-[3px] bg-white rounded-sm"></span>
              )}
            </span>
            <span className="text-sm text-foreground">{it}</span>
          </label>
        )
      })}
    </div>
  )
})