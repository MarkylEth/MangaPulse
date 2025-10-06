'use client';

import React, { useState } from 'react';
import { Plus, Link2, Clapperboard, GitBranch, Save } from 'lucide-react';
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
  const card   = theme === 'light' ? 'bg-white' : 'bg-slate-800';
  const btnPri = theme === 'light' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-black hover:opacity-90';

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
        body = { target_type: 'link', relation: relLink || 'adaptation', title: title.trim(), url: url.trim(), cover_url: cover.trim() || null, kind: 'anime' };
      } else {
        if (!title.trim() || !url.trim()) { alert('Нужны заголовок и ссылка'); return; }
        body = { target_type: 'link', relation: relLink || 'related', title: title.trim(), url: url.trim(), cover_url: cover.trim() || null, kind: 'external' };
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className={`relative w-full max-w-md rounded-2xl border ${border} ${card} p-4`}>
        <div className="text-lg font-semibold mb-1">Добавить связанное</div>
        <div className="text-xs opacity-70 mb-3">Тайтл ID: {mangaId}</div>

        {/* режим */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <button onClick={() => setMode('manga')} className={`px-3 py-2 rounded-lg text-sm border ${border} ${mode==='manga'?'bg-blue-600 text-white':''}`}><GitBranch className="w-4 h-4 inline mr-1" />Манга</button>
          <button onClick={() => setMode('anime-link')} className={`px-3 py-2 rounded-lg text-sm border ${border} ${mode==='anime-link'?'bg-blue-600 text-white':''}`}><Clapperboard className="w-4 h-4 inline mr-1" />Аниме</button>
          <button onClick={() => setMode('external-link')} className={`px-3 py-2 rounded-lg text-sm border ${border} ${mode==='external-link'?'bg-blue-600 text-white':''}`}><Link2 className="w-4 h-4 inline mr-1" />Ссылка</button>
        </div>

        {mode === 'manga' ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm">ID манги</label>
              <input
                type="number"
                value={targetId as number | undefined}
                onChange={(e) => setTargetId(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent"
              />
            </div>
            <div>
              <label className="text-sm">Тип связи</label>
              <select value={relManga} onChange={(e)=>setRelManga(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent">
                {RELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm">{mode==='anime-link'?'Название аниме':'Заголовок'}</label>
              <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="text-sm">URL</label>
              <input value={url} onChange={(e)=>setUrl(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="text-sm">Обложка (опц.)</label>
              <input value={cover} onChange={(e)=>setCover(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent" />
            </div>
            <div>
              <label className="text-sm">Тип связи</label>
              <select value={relLink} onChange={(e)=>setRelLink(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 bg-transparent">
                {RELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setOpen(false)} className="px-3 py-2 rounded-lg border">Отмена</button>
          <button onClick={submit} disabled={saving} className={`px-3 py-2 rounded-lg inline-flex items-center gap-2 ${btnPri}`}>
            <Save className="w-4 h-4" /> {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
