// components/AddNewsModal.tsx
'use client';

import React from 'react';
import { X, Bold, Italic, Underline, Strikethrough, EyeOff, Pin } from 'lucide-react';
import { newsToHtml } from '@/components/news/formatNews';

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
    'inline-flex items-center justify-center rounded-md border border-[rgb(var(--border))] ' +
    'bg-[rgb(var(--muted))]/50 hover:bg-[rgb(var(--muted))] px-2.5 py-1.5 ' +
    'transition active:translate-y-px focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-sky-500/40';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* backdrop (закрытие по клику отключено) */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
      />
      {/* dialog */}
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        className="relative z-[95] w-[min(760px,calc(100vw-32px))] rounded-2xl
                  bg-white/85 dark:bg-[rgb(var(--card))]/85 backdrop-blur-xl
                  border border-black/10 dark:border-[rgb(var(--border))]
                  shadow-[0_24px_120px_rgba(0,0,0,.55)]"
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-semibold">Новая новость</span>
            {pinned && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md
                               bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] border border-[rgb(var(--border))]">
                <Pin className="w-3 h-3" />
                Закреплено
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* body */}
        <div className="px-5 pt-4 pb-2 space-y-3 text-[rgb(var(--foreground))]">
          {/* title */}
          <label className="block">
            <span className="sr-only">Заголовок</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заголовок"
              className="w-full rounded-xl bg-[rgb(var(--muted))]/40 border border-[rgb(var(--border))]
                         px-3 py-2.5 outline-none transition
                         focus:ring-2 focus:ring-sky-500/40"
            />
          </label>

          {/* toolbar + toggles */}
          <div className="flex flex-wrap items-center gap-2">
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

            <div className="ml-auto flex items-center gap-3">
              {/* pinned toggle — ПИЛЮЛЬНАЯ КНОПКА */}
              <button
                type="button"
                aria-pressed={pinned}
                onClick={() => setPinned((v) => !v)}
                disabled={busy}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition border select-none",
                  pinned
                    ? "bg-sky-600 text-white border-sky-600 hover:bg-sky-700"
                    : "bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]/80",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                ].join(" ")}
                title={pinned ? "Открепить" : "Закрепить"}
              >
                <Pin className="w-4 h-4" />
                {pinned ? "Закреплено" : "Закрепить"}
              </button>

              <button
                className="text-sm font-medium underline decoration-dotted underline-offset-4
                           hover:opacity-80 transition"
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? 'Скрыть предпросмотр' : 'Предпросмотр'}
              </button>
            </div>
          </div>

          {/* editor / preview */}
          {!preview ? (
            <label className="block">
              <span className="sr-only">Текст новости</span>
              <textarea
                ref={taRef}
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onKey}
                className="w-full rounded-xl bg-[rgb(var(--muted))]/40 border border-[rgb(var(--border))]
                           px-3 py-3 outline-none transition text-[15px] leading-relaxed
                           focus:ring-2 focus:ring-sky-500/40"
              />
            </label>
          ) : (
            <div
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30
                         p-4 text-[15px] leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: newsToHtml(body) }}
            />
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-black/10 dark:border-[rgb(var(--border))]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[rgb(var(--border))]
                       bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10
                       text-sm font-medium transition"
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || !body.trim() || busy}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition
                       disabled:opacity-60 disabled:cursor-not-allowed
                       bg-sky-600 hover:bg-sky-700"
          >
            {busy ? 'Публикую…' : 'Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  );
}
