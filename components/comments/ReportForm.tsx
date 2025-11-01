// components/comments/ReportForm.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, X } from 'lucide-react';
import { Select, type SelectOption } from '@/components/ui/Select';

type Source = 'manga' | 'page' | 'post';

type ReportReason =
  | 'abuse'
  | 'harassment'
  | 'spam'
  | 'hate'
  | 'porn'
  | 'illegal_trade'
  | 'spoiler'
  | 'offtopic'
  | 'other';

const REASONS: SelectOption<ReportReason>[] = [
  { value: 'abuse',         label: 'Оскорбления' },
  { value: 'harassment',    label: 'Травля/домогательства' },
  { value: 'spam',          label: 'Спам/реклама' },
  { value: 'hate',          label: 'Ненависть/дискриминация' },
  { value: 'porn',          label: '18+ контент' },
  { value: 'illegal_trade', label: 'Незаконная торговля' },
  { value: 'spoiler',       label: 'Спойлеры' },
  { value: 'offtopic',      label: 'Офтоп' },
  { value: 'other',         label: 'Другое' },
];

const NOTE_MAX = 500;

// соответствие UI-причин и бэкенд-причин
const reasonMap: Record<
  ReportReason,
  'spam' | 'offtopic' | 'insult' | 'spoiler' | 'nsfw' | 'illegal' | 'other'
> = {
  abuse: 'insult',
  harassment: 'insult',
  spam: 'spam',
  hate: 'insult',
  porn: 'nsfw',
  illegal_trade: 'illegal',
  spoiler: 'spoiler',
  offtopic: 'offtopic',
  other: 'other',
};

type BaseProps = {
  /** источник комментария */
  source?: Source; // по умолчанию 'manga'
  /** id манги/страницы/поста — может не понадобиться на сервере, но удобно в пропсах */
  targetId?: string | number;
  /** uuid комментария */
  commentId: string;
  /** колбэк после успешной отправки (флаг скрыт ли комментарий на сервере) */
  onDone?: (hidden: boolean) => void;
  /** кастомная кнопка/триггер (будет обёрнута) */
  children?: React.ReactElement<any>;
  /** отображать ли форму для гостя */
  loggedIn?: boolean;
};

/** Обёртка без хуков (можно безопасно использовать в любом месте) */
export default function ReportForm(props: BaseProps) {
  const { loggedIn = false } = props;
  if (!loggedIn) return null;
  return <ReportFormInner {...props} />;
}

/** Реализация формы с хуками (рендерится только для залогиненных) */
function ReportFormInner({
  source = 'manga',
  targetId,
  commentId,
  onDone,
  children,
}: BaseProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('abuse');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [mounted, setMounted] = useState(false);

  // Чтобы портал не ломал гидратацию
  useEffect(() => setMounted(true), []);

  // Лочим скролл и вешаем ESC при открытой модалке
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function submit() {
    if (state === 'sending') return;
    setState('sending');
    try {
      const payload = {
        source,
        commentId,
        reason: reasonMap[reason],
        details: note.trim(),
        // можно передать targetId на бэкенд если нужно логировать контекст
        targetId: targetId ?? null,
      };

      const r = await fetch(`/api/comments/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (r.status === 401) {
        setState('idle');
        setOpen(false);
        return;
      }

      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; is_hidden?: boolean };
      if (!r.ok || j?.ok === false) throw new Error(`HTTP ${r.status}`);

      setState('sent');
      setOpen(false);
      onDone?.(!!j?.is_hidden);
    } catch (e) {
      setState('error');
      console.error('report failed', e);
    }
  }

  // триггер (иконка) или пользовательская кнопка
  let trigger: React.ReactNode;
  if (children && React.isValidElement(children)) {
    const ch = children as React.ReactElement<any>;
    const prevOnClick = (ch.props as any)?.onClick;
    trigger = React.cloneElement(ch, {
      ...(ch.props as any),
      onClick: (e: any) => {
        if (typeof prevOnClick === 'function') prevOnClick(e);
        setOpen(true);
      },
      disabled: state === 'sending' || (ch.props as any)?.disabled,
      title: undefined,
      'aria-label': (ch.props as any)?.['aria-label'] ?? 'Жалоба',
    } as any);
  } else {
    trigger = (
      <button
        type="button"
        className="
          p-1.5 rounded-md transition-all
          text-amber-700 bg-amber-100/80 ring-1 ring-amber-200/70 hover:bg-amber-200/80 hover:ring-amber-300
          dark:text-yellow-400 dark:bg-yellow-500/10 dark:hover:bg-yellow-500/20 dark:ring-0
        "
        onClick={() => setOpen(true)}
        disabled={state === 'sending'}
        aria-label="Жалоба"
      >
        <Flag className="w-3.5 h-3.5" />
      </button>
    );
  }

  const remaining = Math.max(0, NOTE_MAX - note.length);

  return (
    <>
      {trigger}

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] isolate flex items-center justify-center p-4
                       bg-black/60 backdrop-blur-sm"
            onMouseDown={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-xl sm:max-w-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className="
                  relative overflow-visible
                  rounded-2xl border border-black/10 dark:border-white/10
                  bg-white/90 dark:bg-[#0f1115]/90 backdrop-blur-xl
                  shadow-2xl
                  text-gray-900 dark:text-gray-100
                "
              >
                {/* Хедер */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-yellow-100/80 dark:bg-yellow-500/15">
                      <Flag className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <h3 className="text-base font-semibold">Пожаловаться на комментарий</h3>
                  </div>
                  <button
                    className="p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() => setOpen(false)}
                    aria-label="Закрыть"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Контент */}
                <div className="p-4 space-y-3 pb-5">
                  <label className="block text-xs text-gray-600 dark:text-gray-400">Причина</label>

                  <Select<ReportReason>
                    value={reason}
                    onChange={setReason}
                    options={REASONS}
                    className="h-10 text-gray-900 dark:text-gray-100"
                    contentClassName="
                      z-[11000]
                      left-[-16px] right-[-16px]
                      rounded-2xl border border-black/10 dark:border-white/10
                      shadow-2xl bg-white dark:bg-[#0f1115]
                    "
                  />

                  <label className="block text-xs text-gray-600 dark:text-gray-400">
                    Комментарий (необязательно)
                  </label>
                  <div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                      rows={4}
                      maxLength={NOTE_MAX}
                      placeholder="Опишите подробности…"
                      className="
                        w-full text-sm rounded-xl
                        border border-black/10 dark:border-white/15
                        bg-white/90 dark:bg-black/30
                        text-gray-900 dark:text-gray-100
                        placeholder:text-gray-400 dark:placeholder:text-gray-500
                        caret-gray-900 dark:caret-gray-200
                        px-3 py-2
                        outline-none focus:ring-2 ring-indigo-500/40
                        resize-none
                      "
                    />
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 text-right">
                      {remaining} / {NOTE_MAX}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      className="
                        text-sm px-4 py-2 rounded-xl
                        border border-black/10 dark:border-white/10
                        bg-black/5 hover:bg-black/10
                        dark:bg-white/5 dark:hover:bg-white/10
                        transition-all
                      "
                      onClick={() => setOpen(false)}
                    >
                      Отмена
                    </button>
                    <button
                      className="
                        text-sm px-4 py-2 rounded-xl
                        bg-indigo-600 hover:bg-indigo-500
                        text-white transition-all disabled:opacity-60
                      "
                      onClick={submit}
                      disabled={state === 'sending'}
                    >
                      {state === 'sending' ? 'Отправка…' : 'Отправить'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
