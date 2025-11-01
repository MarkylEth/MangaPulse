// components/news/NewsCommentEditor.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, CornerDownRight, X, EyeOff } from 'lucide-react';

/* ================= sanitize ================= */
export function sanitize(input: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');

  const pass = new Set(['b', 'i', 'u', 's', 'br', 'strong', 'em', 'span', 'details', 'summary', 'div']);
  const blockLike = new Set(['div', 'p', 'li', 'ul', 'ol', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

  function clean(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'strike' || tag === 'del') {
      const out = document.createElement('s');
      el.childNodes.forEach(ch => { const c = clean(ch); if (c) out.appendChild(c); });
      return out;
    }

    if (pass.has(tag)) {
      const out = document.createElement(tag);
    
      if (tag === 'details' && el.classList.contains('spoiler')) {
        out.classList.add('spoiler');
      }
    
      if (tag === 'span') {
        if (el.classList.contains('spoiler-blur')) {
          out.classList.add('spoiler-blur');
        }
        const st = el.style;
        if (st.fontWeight === 'bold' || st.fontWeight === '700') out.style.fontWeight = 'bold';
        if (st.fontStyle === 'italic') out.style.fontStyle = 'italic';
        const td = st.textDecoration || st.textDecorationLine || '';
        const u = /underline/i.test(td);
        const s = /line-through|strike/i.test(td);
        if (u && s) out.style.textDecoration = 'underline line-through';
        else if (u) out.style.textDecoration = 'underline';
        else if (s) out.style.textDecoration = 'line-through';
      }
      el.childNodes.forEach(ch => { const c = clean(ch); if (c) out.appendChild(c); });
      return out;
    }

    const frag = document.createDocumentFragment();
    el.childNodes.forEach(ch => { const c = clean(ch); if (c) frag.appendChild(c); });
    if (blockLike.has(tag)) frag.appendChild(document.createElement('br'));
    return frag;
  }

  const frag = document.createDocumentFragment();
  doc.body.childNodes.forEach(ch => { const c = clean(ch); if (c) frag.appendChild(c); });
  const div = document.createElement('div'); div.appendChild(frag);

  return div.innerHTML
    .replace(/&nbsp;/gi, ' ')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim();
}

function htmlToPlainText(html: string): string {
  const clean = sanitize(html);
  const withNewlines = clean.replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(withNewlines, 'text/html');
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ');
}

const htmlToPlainLenSafe = (html: string) => htmlToPlainText(html).length;
const getServerLenFromEl = (el: HTMLElement) => htmlToPlainLenSafe(el.innerHTML);
const getServerLinesFromHtml = (html: string) => {
  const t = htmlToPlainText(html);
  return t ? t.split('\n').length : 0;
};
const getServerLinesFromEl = (el: HTMLElement) => getServerLinesFromHtml(el.innerHTML);

/* Инлайновый спойлер c блюром */
export function convertSpoilers(html: string) {
  return html.replace(
    /\|\|([\s\S]+?)\|\|/g,
    '<span class="spoiler-blur" tabindex="0" role="button" aria-label="Спойлер — нажмите, чтобы показать">$1</span>'
  );
}

export type ReplyTo = { id: string; username?: string };
export type NewsCommentEditorProps = {
  me: { id: string } | null;
  disabled?: boolean;
  replyTo: ReplyTo | null;
  onCancelReply: () => void;
  onSubmit: (html: string, replyToId: string | null) => Promise<void>;
  submitting?: boolean;
  maxChars?: number | null;
  maxLines?: number | null;
  headerRight?: React.ReactNode;
};

export default function NewsCommentEditor({
  me, disabled, replyTo, onCancelReply, onSubmit, submitting, maxChars, maxLines = 35, headerRight,
}: NewsCommentEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [textLen, setTextLen] = useState(0);

  const ratio = useMemo(() => (maxChars ? textLen / (maxChars as number) : 0), [textLen, maxChars]);

  const exec = (cmd: string) => {
    if (!me || disabled) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(cmd, false);
    scheduleRecalc();
  };

  const wrapSpoiler = () => {
    if (!me || disabled) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const frag = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);
    const inner = div.innerHTML || sel.toString();
    document.execCommand('insertHTML', false, `||${inner}||`);
    scheduleRecalc();
  };

  const scheduleRecalc = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const currentHtml = sanitize(el.innerHTML);
      const plain = htmlToPlainText(currentHtml);
      const lines = plain ? plain.split('\n').length : 0;
      const len = plain.length;

      setIsEmpty(len === 0);
      setTextLen(len);

      const needCharsCut = maxChars != null && len > (maxChars as number);
      const needLinesCut = maxLines != null && maxLines > 0 && lines > (maxLines as number);

      if (needCharsCut || needLinesCut) {
        let clipped = plain;
        if (needLinesCut) clipped = clipped.split('\n').slice(0, Number(maxLines)).join('\n');
        if (needCharsCut) clipped = clipped.slice(0, Number(maxChars));
        el.innerHTML = clipped.replace(/\n/g, '<br>');
        setTextLen(clipped.trim().length);
      }
    });
  };

  useEffect(() => {
    scheduleRecalc();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [maxChars, maxLines]);

  async function handleSubmit() {
    if (!me || !editorRef.current || disabled) return;
    const el = editorRef.current;

    let currentHtml = sanitize(el.innerHTML);
    currentHtml = currentHtml.replace(/\r?\n/g, '<br>');
    const plain = htmlToPlainText(currentHtml);
    const lines = plain ? plain.split('\n').length : 0;
    const len = plain.length;

    const overChars = maxChars != null && len > (maxChars as number);
    const overLines = maxLines != null && maxLines > 0 && lines > (maxLines as number);

    if (overChars || overLines) {
      let clipped = plain;
      if (overLines) clipped = clipped.split('\n').slice(0, Number(maxLines)).join('\n');
      if (overChars) clipped = clipped.slice(0, Number(maxChars));
      currentHtml = clipped.replace(/\n/g, '<br>');
      el.innerHTML = currentHtml;
      setTextLen(clipped.trim().length);
    }

    const htmlToSend = currentHtml;
    if (!htmlToSend) return;
    await onSubmit(htmlToSend, replyTo?.id ?? null);

    el.innerHTML = '';
    setIsEmpty(true);
    setTextLen(0);
  }

  const handleSpace = () => {
    if (!me || disabled) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    document.execCommand('insertHTML', false, ' ');
    document.execCommand('removeFormat', false);
    scheduleRecalc();
  };

  return (
    <div className="w-full">
      {/* мини-тулбар */}
      <div className="flex items-center gap-1 mb-2">
        <IconBtn icon={<Bold className="w-4 h-4" />} onClick={() => exec('bold')} disabled={!me || disabled} label="Жирный (Ctrl+B)" />
        <IconBtn icon={<Italic className="w-4 h-4" />} onClick={() => exec('italic')} disabled={!me || disabled} label="Курсив (Ctrl+I)" />
        <IconBtn icon={<Underline className="w-4 h-4" />} onClick={() => exec('underline')} disabled={!me || disabled} label="Подчеркнуть (Ctrl+U)" />
        <IconBtn icon={<Strikethrough className="w-4 h-4" />} onClick={() => exec('strikeThrough')} disabled={!me || disabled} label="Зачеркнуть (Ctrl+Shift+X)" />
        <IconBtn icon={<EyeOff className="w-4 h-4" />} onClick={wrapSpoiler} disabled={!me || disabled} label="Спойлер (Ctrl+Shift+S)" />
        <div className="ml-auto">{headerRight}</div>
      </div>

      {/* бейдж «ответ для …» (если есть) */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
          <CornerDownRight className="w-4 h-4" />
          <span>
            Ответ для <span className="font-medium">@{replyTo.username ?? `коммент #${replyTo.id}`}</span>
          </span>
          <button
            onClick={onCancelReply}
            className="ml-auto opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Отменить ответ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* поле ввода — цвета рамки как в примере */}
      <div
        ref={editorRef}
        tabIndex={0}
        role="textbox"
        contentEditable={!!me && !disabled}
        suppressContentEditableWarning
        className={`min-h-[88px] w-full rounded-xl px-3 py-2.5 outline-none text-[15px] leading-relaxed
          whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]
          bg-black/5 dark:bg-black/20
          border border-black/10 dark:border-white/10
          focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10
          focus:shadow-[0_0_0_3px_rgba(0,0,0,.06)] dark:focus:shadow-[0_0_0_3px_rgba(255,255,255,.10)]
          transition-[box-shadow,background-color,border-color] ${!me ? 'cursor-not-allowed opacity-50' : ''}`}
        aria-label="Редактор комментария"
        onInput={scheduleRecalc}
        onFocus={scheduleRecalc}
        onPaste={(e) => {
          e.preventDefault();
          const raw = (e.clipboardData || (window as any).clipboardData).getData('text/plain') || '';
          const el = editorRef.current!;
          const currentLen = getServerLenFromEl(el);
          const currentLines = getServerLinesFromEl(el);

          if (maxChars != null || maxLines != null) {
            let allowedIncoming = raw.replace(/\r\n|\r|\n/g, '\n');
            if (maxLines != null && maxLines > 0) {
              const remainLines = Math.max(0, (maxLines as number) - currentLines);
              if (remainLines <= 0) return;
              allowedIncoming = allowedIncoming.split('\n').slice(0, remainLines).join('\n');
            }
            if (maxChars != null) {
              const remainChars = Math.max(0, (maxChars as number) - currentLen);
              if (remainChars <= 0) return;
              allowedIncoming = allowedIncoming.slice(0, remainChars);
            }
            document.execCommand('insertHTML', false, allowedIncoming.replace(/\n/g, '<br>'));
          } else {
            document.execCommand('insertHTML', false, raw.replace(/\r\n|\r|\n/g, '<br>'));
          }
          requestAnimationFrame(scheduleRecalc);
        }}
        onKeyDown={(e) => {
          if (!me || disabled) return;
        
          // не отправляем "внутри" набора иероглифами/IME
          if ((e as any).isComposing) return;
        
          const key = e.key.toLowerCase();
        
          // Пробел — как у тебя было
          if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            handleSpace();
            return;
          }
        
          // Горячие клавиши форматирования — как было
          if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            if (key === 'b') { e.preventDefault(); exec('bold'); return; }
            if (key === 'i') { e.preventDefault(); exec('italic'); return; }
            if (key === 'u') { e.preventDefault(); exec('underline'); return; }
            if (e.shiftKey && key === 'x') { e.preventDefault(); exec('strikeThrough'); return; }
            if (e.shiftKey && key === 's') { e.preventDefault(); wrapSpoiler(); return; }
            if (key === 'enter') { e.preventDefault(); void handleSubmit(); return; } // Ctrl/Cmd+Enter — отправка
          }
        
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (e.shiftKey) {
              e.preventDefault();
          
              if (maxLines != null && maxLines > 0) {
                const el = editorRef.current!;
                const lines = getServerLinesFromEl(el);
                if (lines >= (maxLines as number)) return;
              }
          
              // Всегда вставляем реальный <br>, плюс zero-width, чтобы курсор «держался»
              document.execCommand('insertHTML', false, '<br>\u200B');
              scheduleRecalc();
              return;
            }
          
            // Просто Enter — отправка
            e.preventDefault();
            if (!isEmpty) void handleSubmit();
            return;
          }          
        
          // Ограничение по символам — оставляем
          if (maxChars != null && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
            const el = editorRef.current!;
            if (getServerLenFromEl(el) >= (maxChars as number)) e.preventDefault();
          }
        }}        
      />

      {/* счётчик + кнопка */}
      <div className="mt-2 flex items-center gap-2">
        {maxChars != null && (
          <div
            className={`text-xs px-2.5 py-1 rounded-md text-[rgb(var(--muted-foreground))] ${
              ratio >= 0.9 ? '!text-red-500 font-medium'
              : ratio >= 0.8 ? '!text-amber-600 font-medium' : ''
            }`}
          >
            {textLen} / {maxChars}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!me || submitting || isEmpty || disabled}
          className="ml-auto px-5 py-2 rounded-xl text-sm font-semibold
            bg-black/90 hover:bg-black
            dark:bg-white/10 dark:hover:bg-white/15
            text-white
            border border-black/10 dark:border-white/10
            shadow-[0_6px_20px_-12px_rgba(0,0,0,.6)]
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Отправка…' : replyTo ? 'Ответить' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}

function IconBtn({ icon, onClick, disabled, label }: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      disabled={!!disabled}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center h-8 w-8 rounded-lg
        border border-black/10 dark:border-white/10
        bg-white/60 dark:bg-white/[0.06]
        hover:bg-white/80 dark:hover:bg-white/[0.10]
        text-gray-800 dark:text-gray-200
        disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {icon}
    </button>
  );
}
