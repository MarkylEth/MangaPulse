'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, ThumbsUp, ThumbsDown, Search, X } from 'lucide-react';

type SimilarItem = {
  id: number;
  title: string;
  slug: string | null;
  poster_url: string | null;
  votes: number;
  likes: number;
  dislikes: number;
  avg_score: number | null;
  score_weighted: number | null;
  my_reaction: 'up' | 'down' | null;
};

type SearchResult = {
  id: number;
  title: string;
  slug: string | null;
  poster_url: string | null;
};

type Props = { mangaId: number; className?: string; perRow?: number };

export default function SimilarTitlesRow({ mangaId, className, perRow = 5 }: Props) {
  const [items, setItems] = useState<SimilarItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<SearchResult | null>(null);

  const originalOrder = useRef<number[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/manga/${mangaId}/similar`, { cache: 'no-store', credentials: 'include' });
        const j = await r.json();
        if (alive && j?.ok) {
          const list: SimilarItem[] = j.items || [];
          originalOrder.current = list.map(x => x.id);
          setItems(list);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [mangaId]);

  // Поиск
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/manga/search?q=${encodeURIComponent(searchQuery)}&limit=10&exclude=${mangaId}`);
        const j = await r.json();
        if (j?.ok) setSearchResults(j.items || []);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, mangaId]);

  const totalPages = Math.max(1, Math.ceil(items.length / perRow));
  const start = page * perRow;
  const visible = useMemo(() => items.slice(start, start + perRow), [items, start, perRow]);

  const next = () => setPage(p => Math.min(totalPages - 1, p + 1));
  const prev = () => setPage(p => Math.max(0, p - 1));

  async function sendAction(otherId: number, action: 'up'|'down'|'clear'|'add') {
    const res = await fetch(`/api/manga/${mangaId}/similar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ otherId, action }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j?.ok) throw new Error(j?.message || `HTTP ${res.status}`);
    return j;
  }

  function optimisticUpdate(otherId: number, action: 'up'|'down'|'clear') {
    setItems(prev => prev.map(it => {
      if (it.id !== otherId) return it;
      let { likes, dislikes, my_reaction } = it;

      if (my_reaction === 'up') likes = Math.max(0, likes - 1);
      if (my_reaction === 'down') dislikes = Math.max(0, dislikes - 1);

      if (action === 'up') { likes += 1; my_reaction = 'up'; }
      else if (action === 'down') { dislikes += 1; my_reaction = 'down'; }
      else { my_reaction = null; }

      return { ...it, likes, dislikes, my_reaction, votes: likes + dislikes };
    }).sort((a,b) => originalOrder.current.indexOf(a.id) - originalOrder.current.indexOf(b.id)));
  }

  function toggleUp(otherId: number) {
    const cur = items.find(x => x.id === otherId)?.my_reaction ?? null;
    const action = cur === 'up' ? 'clear' : 'up';
    optimisticUpdate(otherId, action);
    sendAction(otherId, action)
      .then(j => {
        if (j?.removed) {
          setItems(prev => prev.filter(it => it.id !== otherId));
          originalOrder.current = originalOrder.current.filter(id => id !== otherId);
        }
      })
      .catch(() => window.location.reload());
  }
  function toggleDown(otherId: number) {
    const cur = items.find(x => x.id === otherId)?.my_reaction ?? null;
    const action = cur === 'down' ? 'clear' : 'down';
    optimisticUpdate(otherId, action);
    sendAction(otherId, action)
      .then(j => {
        if (j?.removed) {
          setItems(prev => prev.filter(it => it.id !== otherId));
          originalOrder.current = originalOrder.current.filter(id => id !== otherId);
        }
      })
      .catch(() => window.location.reload());
  }

  async function addSimilar() {
    if (!selectedTitle) return alert('Выберите тайтл из результатов поиска');
    if (selectedTitle.id === mangaId) return alert('Нельзя добавить тот же тайтл');
    try {
      await sendAction(selectedTitle.id, 'add'); // просто создаём пару
      const r = await fetch(`/api/manga/${mangaId}/similar`, { cache: 'no-store', credentials: 'include' });
      const j = await r.json();
      if (j?.ok) {
        const list: SimilarItem[] = j.items || [];
        const order = list.map(x => x.id);
        originalOrder.current = order;
        setItems(list);
      }
    } catch (e: any) {
      alert(e?.message || 'Не удалось добавить');
    }
    setSearchQuery('');
    setSelectedTitle(null);
    setAdding(false);
  }

  function selectTitle(title: SearchResult) {
    setSelectedTitle(title);
    setSearchQuery(title.title);
    setSearchResults([]);
  }

  function clearSelection() {
    setSelectedTitle(null);
    setSearchQuery('');
    setSearchResults([]);
  }

  return (
    <section className={className}>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Похожие тайтлы</h3>
        <div className="flex items-center gap-3">
          {items.length > perRow && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button onClick={prev} disabled={page===0} className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 transition-colors">
                <ChevronLeft size={16}/>
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 py-1 min-w-[4rem] text-center tabular-nums">
                {page+1} / {totalPages}
              </span>
              <button onClick={next} disabled={page>=totalPages-1} className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 transition-colors">
                <ChevronRight size={16}/>
              </button>
            </div>
          )}
          <button onClick={()=>setAdding(v=>!v)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Plus size={16}/> Добавить похожий
          </button>
        </div>
      </div>

      {/* Поиск и добавление */}
      {adding && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Найти тайтл</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Начните вводить название тайтла..."
                  className="block w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedTitle && (
                  <button onClick={clearSelection} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {searchResults.length > 0 && !selectedTitle && (
                <div className="mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => selectTitle(result)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 flex items-center gap-3"
                    >
                      <div className="w-12 h-16 flex-shrink-0 bg-gray-100 dark:bg-gray-600 rounded overflow-hidden">
                        {result.poster_url ? (
                          <Image src={result.poster_url} alt={result.title} width={48} height={64} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <div className="w-6 h-6 border border-current rounded"></div>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{result.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {result.id}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searching && (
                <div className="mt-2 p-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    Поиск...
                  </div>
                </div>
              )}
            </div>

            {selectedTitle && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="w-8 h-10 flex-shrink-0 bg-gray-100 dark:bg-gray-600 rounded overflow-hidden">
                    {selectedTitle.poster_url ? (
                      <Image src={selectedTitle.poster_url} alt={selectedTitle.title} width={32} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <div className="w-3 h-3 border border-current rounded"></div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">{selectedTitle.title}</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">ID: {selectedTitle.id}</div>
                  </div>
                </div>

                <button onClick={addSimilar} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors">
                  Добавить как похожий
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Сетка карточек (без закладок) */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading && (
          <div className="col-span-full py-12 text-center">
            <div className="inline-flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Загружаем...</span>
            </div>
          </div>
        )}

        {!loading && items.length===0 && (
          <div className="col-span-full py-16 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium mb-2">Нет похожих тайтлов</p>
              <p className="text-sm">Добавьте первый, используя кнопку выше</p>
            </div>
          </div>
        )}

        {visible.map(card => (
          <Card key={card.id} item={card} onUp={toggleUp} onDown={toggleDown}/>
        ))}
      </div>
    </section>
  );
}

function Card({
  item, onUp, onDown,
}: {
  item: SimilarItem;
  onUp: (id: number)=>void;
  onDown: (id: number)=>void;
}) {
  const href = item.slug ? `/title/${item.slug}` : `/title/${item.id}`;
  const upActive = item.my_reaction === 'up';
  const downActive = item.my_reaction === 'down';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
      <Link href={href} className="block relative aspect-[3/4] bg-gray-100 dark:bg-gray-700 group">
        {item.poster_url ? (
          <Image
            alt={item.title}
            src={item.poster_url}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width:640px) 48vw, (max-width:1024px) 30vw, 18vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="w-12 h-12 border-2 border-current rounded"></div>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
      </Link>

      <div className="p-3">
        <Link href={href} className="block mb-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {item.title}
          </h4>
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              title="Нравится"
              onClick={()=>onUp(item.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-all duration-200 ${
                upActive 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 shadow-sm' 
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <ThumbsUp size={12} className={upActive ? 'fill-current' : ''} />
              <span className="tabular-nums">{item.likes}</span>
            </button>
            
            <button
              title="Не нравится"
              onClick={()=>onDown(item.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-all duration-200 ${
                downActive 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 shadow-sm' 
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <ThumbsDown size={12} className={downActive ? 'fill-current' : ''} />
              <span className="tabular-nums">{item.dislikes}</span>
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {item.likes + item.dislikes} голос.
          </div>
        </div>
      </div>
    </div>
  );
}
