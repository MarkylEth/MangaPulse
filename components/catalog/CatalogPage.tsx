// components/catalog/CatalogPage.tsx
'use client'

import { useMemo } from 'react'
import { useTheme } from '@/lib/theme/context'
import { Header } from '@/components/Header'
import { applyFiltersAndSort } from '@/lib/catalog/filters'
import { useCatalogData } from '@/hooks/useCatalogData'
import { useCatalogFilters } from '@/hooks/useCatalogFilters'
import { useCatalogPagination } from '@/hooks/useCatalogPagination'
import { CatalogFilters } from '@/components/catalog/CatalogFilters'
import { CatalogGrid } from '@/components/catalog/CatalogGrid'
import { CatalogPagination } from '@/components/catalog/CatalogPagination'

export default function CatalogPage() {
  const { theme } = useTheme()
  const mode: 'light'|'dark' = theme === 'light' ? 'light' : 'dark'

  const { items, allTags, loading, error } = useCatalogData('/api/catalog?limit=200')
  const [filters, dispatch] = useCatalogFilters()

  const data = useMemo(
    () => applyFiltersAndSort(items, filters),
    [items, filters]
  )

  const { page, setPage, pageSize, totalPages, totalItems, pageData } =
    useCatalogPagination(data, 24)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header showSearch={false} />

      <div className="flex-1 mx-auto max-w-[1400px] w-full px-6 py-8">
        <div className="relative lg:flex lg:gap-8">
          {/* Фиксированная боковая панель */}
          <aside className="lg:fixed lg:w-[300px] lg:h-[calc(100vh-7rem)] lg:top-24">
            <div className="h-full overflow-y-auto overflow-x-hidden pr-2 nice-scrollbar">
              <CatalogFilters
                mode={mode}
                filters={filters}
                dispatch={dispatch}
                allTags={allTags}
              />
              <div className="h-4" />
            </div>
          </aside>

          {/* Пустой спейсер для fixed панели */}
          <div className="hidden lg:block w-[300px] shrink-0" />

          {/* Основной контент */}
          <main className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Каталог</h1>
            </div>

            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {Array.from({length: 8}).map((_,i)=>(
                  <div key={i} className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
                    <div className="animate-pulse h-[360px] bg-muted" />
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-muted rounded" />
                      <div className="h-4 bg-muted rounded w-2/3" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="text-rose-500">Ошибка загрузки: {error}</div>}

            {!loading && !error && data.length===0 && (
              <div className="rounded-2xl bg-card border border-border/60 p-8 text-center text-muted-foreground">
                <p className="text-lg mb-2">Ничего не найдено</p>
                <p className="text-sm">Попробуйте изменить фильтры или выполнить новый поиск</p>
              </div>
            )}

            {!loading && !error && data.length>0 && (
              <>
                <CatalogGrid items={pageData} mode={mode} />
                <CatalogPagination
                  page={page}
                  totalPages={totalPages}
                  onChange={setPage}
                  theme={mode}
                  totalItems={totalItems}
                  pageSize={pageSize}
                />
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}