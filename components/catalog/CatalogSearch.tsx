// components/catalog/CatalogSearch.tsx
'use client'

export function CatalogSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      value={value}
      onChange={(e)=>onChange(e.target.value)}
      placeholder="Поиск по названию/автору…"
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
    />
  )
}
