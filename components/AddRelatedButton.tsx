'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Link2, Clapperboard, GitBranch, X } from 'lucide-react';
import { useTheme } from '@/lib/theme/context';
import { useRouter } from 'next/navigation';

type Props = {
  mangaId: number;
  compact?: boolean;
  onDone?: () => void;
};

const RELS = [
  { value: 'adaptation', label: 'Адаптация' },
  { value: 'sequel',     label: 'Сиквел' },
  { value: 'prequel',    label: 'Приквел' },
  { value: 'spin-off',   label: 'Спин-офф' },
  { value: 'alt',        label: 'Альтернативная история' },
  { value: 'related',    label: 'Связано' },
];

export default function AddRelatedButton({ mangaId, compact, onDone }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [mode, setMode] = useState<'manga'|'anime-link'|'external-link'>('manga');

  // manga
  const [targetId, setTargetId] = useState<number | ''>('');
  const [relManga, setRelManga] = useState('related');

  // link/anime
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [cover, setCover] = useState('');
  const [relLink, setRelLink] = useState('adaptation');

  const [saving, setSaving] = useState(false);

  const border = theme === 'light' ? 'border-gray-200' : 'border-white/10';

  // Лок скролла при открытии
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      const sbw = window.innerWidth - root.clientWidth;
      root.classList.add('overflow-hidden');
      root.style.paddingRight = `${sbw}px`;
    } else {
      root.classList.remove('overflow-hidden');
      root.style.paddingRight = '';
    }
    return () => {
      root.classList.remove('overflow-hidden');
      root.style.paddingRight = '';
    };
  }, [open]);

  async function submit() {
    setSaving(true);
    try {
      let body: any;

      if (mode === 'manga') {
        const id = Number(targetId);
        if (!Number.isFinite(id) || id <= 0) { alert('Укажите корректный ID манги'); return; }
        body = { target_type: 'manga', target_id: id, relation: relManga };
      } else if (mode === 'anime-link') {
        if (!title.trim() || !url.trim()) { alert('Нужны заголовок и ссылка'); return; }
        body = {
          target_type: 'link',
          relation: relLink || 'adaptation',
          title: title.trim(),
          url: url.trim(),
          cover_url: cover.trim() || null,
          kind: 'anime',
        };
      } else {
        if (!title.trim() || !url.trim()) { alert('Нужны заголовок и ссылка'); return; }
        body = {
          target_type: 'link',
          relation: relLink || 'related',
          title: title.trim(),
          url: url.trim(),
          cover_url: cover.trim() || null,
          kind: 'external',
        };
      }

      const res = await fetch(`/api/manga/${mangaId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);

      setOpen(false);
      setTitle(''); setUrl(''); setCover('');
      setTargetId(''); setRelManga('related'); setRelLink('adaptation');
      onDone?.();
      router.refresh();
    } catch (e: any) {
      alert(e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  const Button = (
    <button
      onClick={() => setOpen(true)}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm border ${border} ${theme === 'light' ? 'bg-white hover:bg-gray-100' : 'bg-slate-900/60 hover:bg-slate-800'}`}
      title="Добавить связанное"
    >
      <Plus className="w-4 h-4" />
      {!compact && <span>Добавить связанное</span>}
    </button>
  );

  if (!open) return Button;

  const fieldCls = `
    mt-1 w-full rounded-lg px-3 py-2
    border border-black/10 dark:border-white/10
    bg-white/70 dark:bg-white/[0.06] backdrop-blur
    text-black dark:text-white placeholder:text-gray-500
    focus:outline-none focus:ring-2
    focus:ring-black/20 dark:focus:ring-white/20
  `;

  // делаем список селекта читаемым в дарке
  const selectStyle: React.CSSProperties = { colorScheme: 'light' };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm md:backdrop-blur"
        onClick={() => setOpen(false)}
      />

      <div
        className="
          relative z-50 w-full max-w-md rounded-2xl
          bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-xl
          border border-black/10 dark:border-white/10
          p-5 md:p-6
          shadow-[0_20px_80px_rgba(0,0,0,.6)]
        "
      >
        {/* Крестик */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Закрыть"
          className="absolute right-3 top-3 p-2 rounded-lg
                     text-gray-600 hover:text-black
                     dark:text-gray-400 dark:hover:text-white
                     hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-lg font-semibold mb-1">Добавить связанное</div>
        <div className="text-xs opacity-70 mb-3">Тайтл ID: {mangaId}</div>

        {/* режим */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <button
            onClick={() => setMode('manga')}
            className={`
              px-3 py-2 rounded-lg text-sm
              border border-black/10 dark:border-white/10
              bg-white/60 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/[0.09]
              transition
              ${mode==='manga' ? 'ring-2 ring-black/15 dark:ring-white/20' : ''}
            `}
          >
            <GitBranch className="w-4 h-4 inline mr-1" />Манга
          </button>
          <button
            onClick={() => setMode('anime-link')}
            className={`
              px-3 py-2 rounded-lg text-sm
              border border-black/10 dark:border-white/10
              bg-white/60 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/[0.09]
              transition
              ${mode==='anime-link' ? 'ring-2 ring-black/15 dark:ring-white/20' : ''}
            `}
          >
            <Clapperboard className="w-4 h-4 inline mr-1" />Аниме
          </button>
          <button
            onClick={() => setMode('external-link')}
            className={`
              px-3 py-2 rounded-lg text-sm
              border border-black/10 dark:border-white/10
              bg-white/60 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/[0.09]
              transition
              ${mode==='external-link' ? 'ring-2 ring-black/15 dark:ring-white/20' : ''}
            `}
          >
            <Link2 className="w-4 h-4 inline mr-1" />Ссылка
          </button>
        </div>

        {mode === 'manga' ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm">ID манги</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={targetId as number | undefined}
                onChange={(e) => setTargetId(e.target.value === '' ? '' : Number(e.target.value))}
                className={fieldCls}
                placeholder="Например, 123"
              />
            </div>
            <div>
              <label className="text-sm">Тип связи</label>
              <select
                value={relManga}
                onChange={(e)=>setRelManga(e.target.value)}
                className={`${fieldCls} [&>option]:text-black dark:[&>option]:text-black`}
                style={selectStyle}
              >
                {RELS.map(r => (
                  <option key={r.value} value={r.value} className="text-black" style={{color:'#000'}}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm">{mode==='anime-link'?'Название аниме':'Заголовок'}</label>
              <input
                value={title}
                onChange={(e)=>setTitle(e.target.value)}
                className={fieldCls}
                placeholder={mode==='anime-link' ? 'Например, Demon Slayer' : 'Короткий заголовок'}
              />
            </div>
            <div>
              <label className="text-sm">URL</label>
              <input
                value={url}
                onChange={(e)=>setUrl(e.target.value)}
                className={fieldCls}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="text-sm">Обложка (опц.)</label>
              <input
                value={cover}
                onChange={(e)=>setCover(e.target.value)}
                className={fieldCls}
                placeholder="https://…/cover.jpg"
              />
            </div>
            <div>
              <label className="text-sm">Тип связи</label>
              <select
                value={relLink}
                onChange={(e)=>setRelLink(e.target.value)}
                className={`${fieldCls} [&>option]:text-black dark:[&>option]:text-black`}
                style={selectStyle}
              >
                {RELS.map(r => (
                  <option key={r.value} value={r.value} className="text-black" style={{color:'#000'}}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={()=>setOpen(false)}
            className="
              px-3 py-2 rounded-lg
              bg-white/70 dark:bg-white/[0.06] backdrop-blur
              border border-black/10 dark:border-white/10
              hover:bg-white/90 dark:hover:bg-white/[0.09]
              transition
            "
          >
            Отмена
          </button>

          {/* строгая контрастная кнопка */}
          <button
            onClick={submit}
            disabled={saving}
            className="
              px-3 py-2 rounded-lg
              bg-slate-900 text-white hover:bg-slate-800
              dark:bg-white dark:text-black dark:hover:bg-white
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-black/20 dark:focus-visible:ring-white/20
              disabled:opacity-60
              transition
            "
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
