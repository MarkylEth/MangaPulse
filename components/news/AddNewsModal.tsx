//components\AddNewsModal.tsx
'use client';

import React from 'react';
import { X, Bold, Italic, Underline, Strikethrough, EyeOff } from 'lucide-react';
import { newsToHtml } from '@/components/comments/news/formatNews';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (newsId: number) => void;
  initial?: { title?: string; body?: string; pinned?: boolean };
};

export default function AddNewsModal({ isOpen, onClose, onCreated, initial }: Props) {
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [body, setBody] = React.useState(initial?.body ?? '');
  const [pinned, setPinned] = React.useState(Boolean(initial?.pinned));
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setPinned(Boolean(initial?.pinned));
    setBusy(false);
    setPreview(false);
    setTimeout(() => taRef.current?.focus(), 0);
  }, [isOpen, initial]);

  if (!isOpen) return null;

  function wrapSel(before: string, after = before) {
    const ta = taRef.current!;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const has = end > start;

    const selected = body.slice(start, end);
    const insertion = has ? `${before}${selected}${after}` : `${before}${after}`;
    const next = body.slice(0, start) + insertion + body.slice(end);

    setBody(next);

    const caret = has ? start + insertion.length : start + before.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    const k = e.key.toLowerCase();

    if (k === 'b') { e.preventDefault(); wrapSel('**', '**'); }
    if (k === 'i') { e.preventDefault(); wrapSel('*', '*'); }
    if (k === 'u') { e.preventDefault(); wrapSel('[u]', '[/u]'); }
    if (e.shiftKey && k === 'x') { e.preventDefault(); wrapSel('~~', '~~'); }
    if (e.shiftKey && k === 's') { e.preventDefault(); wrapSel('||', '||'); }
  }

  async function submit() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body, pinned }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? 'create_failed');
      onClose();
      if (j?.data?.id && onCreated) onCreated(j.data.id);
    } finally {
      setBusy(false);
    }
  }

  const tbtn =
    'inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 hover:bg-white/10 active:translate-y-px transition';

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="w-[min(720px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#111] text-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="text-lg font-semibold">Новая новость</div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* body */}
        <div className="px-5 pt-4 pb-2 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40"
          />

          {/* ───── toolbar ───── */}
          <div className="flex items-center gap-2">
            <button className={tbtn} onClick={() => wrapSel('**', '**')} title="Жирный (Ctrl+B)">
              <Bold className="w-4 h-4" />
            </button>
            <button className={tbtn} onClick={() => wrapSel('*', '*')} title="Курсив (Ctrl+I)">
              <Italic className="w-4 h-4" />
            </button>
            <button className={tbtn} onClick={() => wrapSel('[u]', '[/u]')} title="Подчёркнутый (Ctrl+U)">
              <Underline className="w-4 h-4" />
            </button>
            <button className={tbtn} onClick={() => wrapSel('~~', '~~')} title="Зачёркнутый (Ctrl+Shift+X)">
              <Strikethrough className="w-4 h-4" />
            </button>
            <button className={tbtn} onClick={() => wrapSel('||', '||')} title="Спойлер (Ctrl+Shift+S)">
              <EyeOff className="w-4 h-4" />
            </button>

            <div className="ml-auto">
              <button
                className="text-sm underline decoration-dotted underline-offset-4 hover:opacity-80"
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? 'Скрыть предпросмотр' : 'Предпросмотр'}
              </button>
            </div>
          </div>

          {!preview ? (
            <textarea
              ref={taRef}
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKey}
              placeholder="Текст новости… Поддерживаются **жирный**, *курсив*, [u]подчёркнутый[/u], ~~зачёркнутый~~ и спойлер ||текст||"
              className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          ) : (
            <div
              className="rounded-lg border border-white/10 bg-black/10 p-4 text-[15px] leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: newsToHtml(body) }}
            />
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || !body.trim() || busy}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60"
          >
            Опубликовать
          </button>
        </div>
      </div>
    </div>
  );
}
