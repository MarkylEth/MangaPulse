// components/catalog/filters/FilterSection.tsx
'use client'

import { useState } from 'react'

export function FilterSection({
  title, mode, defaultOpen = false, onReset, children
}: {
  title: string
  mode: 'light'|'dark'
  defaultOpen?: boolean
  onReset?: () => void
  children: (controls: { close: () => void }) => React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  
  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden transition-all duration-200">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
           onClick={() => setOpen(o => !o)}>
        <button className="font-semibold text-foreground flex items-center gap-1 w-full text-left">
          <span className="transition-transform duration-200" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▸
          </span>
          {title}
        </button>
        {onReset && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Предотвращаем сворачивание при клике на сброс
              onReset();
            }}
            className="text-xs rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            сбросить
          </button>
        )}
      </div>
      
      <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 pt-1">
          {children({ close: () => setOpen(false) })}
        </div>
      </div>
    </div>
  )
}