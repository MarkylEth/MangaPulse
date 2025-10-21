// components/catalog/CatalogPagination.tsx
'use client'

export function CatalogPagination({
  page,
  totalPages,
  onChange,
  theme,
  totalItems,
  pageSize
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
  theme: 'light' | 'dark'
  totalItems: number
  pageSize: number
}) {
  const btnBase = "px-3 h-9 rounded-lg border text-sm transition"
  const on = "bg-accent text-white border-accent"
  const off = "bg-background border-border text-foreground hover:bg-muted"
  const disabled = "bg-muted border-border text-muted-foreground cursor-not-allowed"

  const makePageItems = (p: number, t: number): (number | 'dots')[] => {
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
    if (p <= 3) return [1, 2, 3, 'dots', t]
    if (p >= t - 2) return [1, 'dots', t - 2, t - 1, t]
    return [1, 'dots', p - 1, p, p + 1, 'dots', t]
  }

  const items = makePageItems(page, totalPages)
  const toFirst = () => onChange(1)
  const toPrev = () => onChange(Math.max(1, page - 1))
  const toNext = () => onChange(Math.min(totalPages, page + 1))
  const toLast = () => onChange(totalPages)

  const infoText = (() => {
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, totalItems)
    return `${from}–${to} из ${totalItems}`
  })()

  return (
    <div className="mt-6 mb-2 flex flex-col items-center gap-3">
      <div className="text-muted-foreground">
        {infoText} • Стр. {page} / {totalPages}
      </div>

      <div className="flex items-center gap-2">
        <button
          className={`${btnBase} ${page === 1 ? disabled : off}`}
          onClick={toFirst}
          disabled={page === 1}
          aria-label="В начало"
          title="В начало"
        >
          «
        </button>
        <button
          className={`${btnBase} ${page === 1 ? disabled : off}`}
          onClick={toPrev}
          disabled={page === 1}
          aria-label="Назад"
          title="Назад"
        >
          ‹
        </button>

        {items.map((it, idx) =>
          it === 'dots' ? (
            <span key={`dots-${idx}`} className="px-2 text-muted-foreground">…</span>
          ) : (
            <button
              key={String(it)}
              className={`${btnBase} ${page === it ? on : off}`}
              onClick={() => onChange(Number(it))}
              aria-current={page === it ? 'page' : undefined}
            >
              {it}
            </button>
          )
        )}

        <button
          className={`${btnBase} ${page === totalPages ? disabled : off}`}
          onClick={toNext}
          disabled={page === totalPages}
          aria-label="Вперёд"
          title="Вперёд"
        >
          ›
        </button>
        <button
          className={`${btnBase} ${page === totalPages ? disabled : off}`}
          onClick={toLast}
          disabled={page === totalPages}
          aria-label="В конец"
          title="В конец"
        >
          »
        </button>
      </div>
    </div>
  )
}
