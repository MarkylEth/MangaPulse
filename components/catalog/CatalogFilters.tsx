// components/catalog/CatalogFilters.tsx
'use client'

import { memo } from 'react'
import type { FiltersAction, FiltersState } from '@/components/catalog/types'
import { FilterSection } from '@/components/catalog/filters/FilterSection'
import { GENRES, AGE, FORMAT, MY_LISTS, OTHER, TITLE_STATUS, TRANSLATION_STATUS, TYPES } from '@/lib/catalog/constants'
import { GenreFilter } from '@/components/catalog/filters/GenreFilter'
import { TagFilter } from '@/components/catalog/filters/TagFilter'
import { RangeFilter } from '@/components/catalog/filters/RangeFilter'
import { CheckboxFilter } from '@/components/catalog/filters/CheckboxFilter'

export const CatalogFilters = memo(function CatalogFilters({
  mode,
  filters,
  dispatch,
  allTags,
}: {
  mode: 'light'|'dark'
  filters: FiltersState
  dispatch: React.Dispatch<FiltersAction>
  allTags: string[]
}) {
  return (
    <div className="space-y-4">
      {/* Поиск и сортировка - всегда видимы */}
      <div className="rounded-2xl p-4 bg-card border border-border/60 shadow-sm">
      <label className="block text-xs mb-1 text-muted-foreground">Поиск по каталогу</label>
        <input
          value={filters.search}
          onChange={(e)=>dispatch({type:'setSearch', value:e.target.value})}
          placeholder="Поиск по названию/автору…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />

        <div className="mt-3">
          <label className="block text-xs mb-1 text-muted-foreground">Сортировка</label>
          <select
            value={filters.sort}
            onChange={(e)=>dispatch({type:'setSort', value:e.target.value as FiltersState['sort']})}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer"
          >
            <option value="pop">По популярности</option>
            <option value="rating">По рейтингу</option>
            <option value="views">По просмотрам</option>
            <option value="date">По дате добавления</option>
            <option value="year">По году</option>
            <option value="chapters">По количеству глав</option>
            <option value="nameAZ">По названию (А-Я)</option>
            <option value="nameZA">По названию (Я-А)</option>
          </select>
        </div>
      </div>

      {/* Остальные фильтры */}
      <div className="space-y-4">
        {/* Жанры */}
        <FilterSection
          title="Жанры"
          mode={mode}
          defaultOpen={false}
          onReset={()=>dispatch({type:'clearTri', field:'genresTri'})}
        >
          {({close}) => (
            <>
              <GenreFilter
                items={GENRES as unknown as string[]}
                tri={filters.genresTri}
                strict={filters.genreStrict}
                onCycle={(item)=>dispatch({type:'cycleTri', field:'genresTri', item})}
                onToggleStrict={(v)=>dispatch({type:'setStrict', field:'genreStrict', value:v})}
                mode={mode}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={()=>dispatch({type:'clearTri', field:'genresTri'})}
                  className="px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted transition"
                >
                  Сбросить
                </button>
                <button onClick={close} className="px-3 py-2 text-sm rounded-lg bg-accent text-white hover:opacity-90">
                  Выбрать
                </button>
              </div>
            </>
          )}
        </FilterSection>

        {/* Теги */}
        <FilterSection
          title="Теги"
          mode={mode}
          defaultOpen={false}
          onReset={()=>dispatch({type:'clearTri', field:'tagsTri'})}
        >
          {({close}) => (
            <>
              <TagFilter
                items={allTags}
                tri={filters.tagsTri}
                strict={filters.tagStrict}
                onCycle={(item)=>dispatch({type:'cycleTri', field:'tagsTri', item})}
                onToggleStrict={(v)=>dispatch({type:'setStrict', field:'tagStrict', value:v})}
                mode={mode}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={()=>dispatch({type:'clearTri', field:'tagsTri'})}
                  className="px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted transition"
                >
                  Сбросить
                </button>
                <button onClick={close} className="px-3 py-2 text-sm rounded-lg bg-accent text-white hover:opacity-90">
                  Выбрать
                </button>
              </div>
            </>
          )}
        </FilterSection>

        {/* Диапазоны */}
        <FilterSection title="Количество глав" mode={mode} defaultOpen={true}>
          {() => (
            <RangeFilter
              value={filters.chapters}
              onChange={(r)=>dispatch({type:'setRange', field:'chapters', range:r})}
              placeholderMin="от"
              placeholderMax="до"
              mode={mode}
            />
          )}
        </FilterSection>

        <FilterSection title="Год релиза" mode={mode} defaultOpen={true}>
          {() => (
            <RangeFilter
              value={filters.year}
              onChange={(r)=>dispatch({type:'setRange', field:'year', range:r})}
              placeholderMin="от"
              placeholderMax="до"
              mode={mode}
            />
          )}
        </FilterSection>

        <FilterSection title="Оценка (0 - 10)" mode={mode} defaultOpen={true}>
          {() => (
            <RangeFilter
              value={filters.rating10}
              onChange={(r)=>dispatch({type:'setRange', field:'rating10', range:r})}
              placeholderMin="минимум"
              placeholderMax="максимум"
              mode={mode}
            />
          )}
        </FilterSection>

        {/* Группы чекбоксов */}
        <FilterSection title="Тип" mode={mode} defaultOpen={true}>
          {() => (
            <CheckboxFilter
              items={TYPES as unknown as string[]}
              selected={filters.type as Set<string>}
              onToggle={(v)=>dispatch({type:'toggleMulti', field:'type', value:v})}
              columns={1}
            />
          )}
        </FilterSection>

        <FilterSection title="Возрастной рейтинг" mode={mode} defaultOpen={true}>
          {() => (
            <CheckboxFilter
              items={AGE as unknown as string[]}
              selected={filters.age as unknown as Set<string>}
              onToggle={(v)=>dispatch({type:'toggleMulti', field:'age', value:v})}
              columns={4}
            />
          )}
        </FilterSection>

        <FilterSection title="Статус тайтла" mode={mode} defaultOpen={true}>
          {() => (
            <CheckboxFilter
              items={TITLE_STATUS as unknown as string[]}
              selected={filters.titleStatus as unknown as Set<string>}
              onToggle={(v)=>dispatch({type:'toggleMulti', field:'titleStatus', value:v})}
              columns={1}
            />
          )}
        </FilterSection>

        <FilterSection title="Статус перевода" mode={mode} defaultOpen={true}>
          {() => (
            <CheckboxFilter
              items={TRANSLATION_STATUS as unknown as string[]}
              selected={filters.translationStatus as unknown as Set<string>}
              onToggle={(v)=>dispatch({type:'toggleMulti', field:'translationStatus', value:v})}
              columns={1}
            />
          )}
        </FilterSection>

        <FilterSection title="Формат выпуска" mode={mode} defaultOpen={true}>
          {() => (
            <CheckboxFilter
              items={FORMAT as unknown as string[]}
              selected={filters.format as unknown as Set<string>}
              onToggle={(v)=>dispatch({type:'toggleMulti', field:'format', value:v})}
              columns={2}
            />
          )}
        </FilterSection>

        <FilterSection title="Другое" mode={mode} defaultOpen={true}>
          {() => (
            <CheckboxFilter
              items={OTHER as unknown as string[]}
              selected={filters.other as unknown as Set<string>}
              onToggle={(v)=>dispatch({type:'toggleMulti', field:'other', value:v})}
              columns={1}
            />
          )}
        </FilterSection>

        <FilterSection title="Мои списки" mode={mode} defaultOpen={true}>
          {() => (
            <CheckboxFilter
              items={MY_LISTS as unknown as string[]}
              selected={filters.my as unknown as Set<string>}
              onToggle={(v)=>dispatch({type:'toggleMulti', field:'my', value:v})}
              columns={2}
            />
          )}
        </FilterSection>
      </div>

      {/* Кнопка сброса всех фильтров */}
      <button
        onClick={()=>dispatch({type:'reset'})}
        className="w-full mt-2 rounded-lg border border-transparent bg-accent text-white py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Сбросить все фильтры
      </button>
    </div>
  )
})