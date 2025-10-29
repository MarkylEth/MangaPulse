// components/reader/ChapterComments/CommentEditor.tsx
'use client';

import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  CornerDownRight,
  X,
  Pin,
  PinOff,
} from 'lucide-react';
import type { SortMode } from '@/lib/reader/types';

interface CommentEditorProps {
  pageId: number;
  userId: string | null;
  replyTo: { id: string } | null;
  onReplyCancel: () => void;
  onCommentSent: () => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

function sanitize(input: string) {
  let html = (input || '').replace(/&nbsp;/gi, ' ');
  html = html.replace(/<strike\b[^>]*>/gi, '<s>').replace(/<\/strike>/gi, '</s>');
  const allow = ['b', 'i', 'u', 's', 'del', 'strong', 'em', 'br'].join('|');
  html = html.replace(new RegExp(String.raw`<(?!\/?(?:${allow})\b)[^>]*>`, 'gi'), '');
  html = html.replace(new RegExp(String.raw`<(?:${allow})>\s*<\/(?:${allow})>`, 'gi'), '');
  html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');
  return html.trim();
}

export default function CommentEditor({
  pageId,
  userId,
  replyTo,
  onReplyCancel,
  onCommentSent,
  sortMode,
  onSortChange,
}: CommentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [sending, setSending] = useState(false);
  const [asTeam, setAsTeam] = useState(false);
  const [pinOnSend, setPinOnSend] = useState(false);

  const sendComment = async () => {
    if (!userId) {
      alert('Войдите, чтобы комментировать');
      return;
    }

    const html = sanitize(editorRef.current?.innerHTML ?? '');
    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
    
    if (!plain) return;

    setSending(true);
    try {
      const r = await fetch(`/api/reader/pages/${pageId}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          content: html,
          parent_id: replyTo?.id ?? null,
          as_team: asTeam,
          pin: pinOnSend,
        }),
      });
      
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Не удалось отправить');

      if (editorRef.current) editorRef.current.innerHTML = '';
      setIsEmpty(true);
      setAsTeam(false);
      setPinOnSend(false);
      onCommentSent();
    } catch (e: any) {
      alert(e?.message ?? 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const pillBtn =
    'px-3 py-1.5 rounded-md bg-[#2a2a2a] border border-[#3a3a3a] shadow-sm hover:bg-[#333333] text-[#e5e7eb] focus-visible:outline-none focus-visible:ring-2 ring-white/10';
  
  const sendBtn =
    'px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] text-[#e5e7eb] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-white/20';

  return (
    <div className="w-full rounded-xl p-4 bg-[#1f1f1f] text-white border border-[#1a1a1a]">
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => document.execCommand('bold')}
            className={pillBtn}
            title="Жирный"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => document.execCommand('italic')}
            className={pillBtn}
            title="Курсив"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => document.execCommand('underline')}
            className={pillBtn}
            title="Подчеркнуть"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const didWork = document.execCommand('strikeThrough');
              if (!didWork) {
                try {
                  document.execCommand('strikethrough');
                } catch {}
              }
            }}
            className={pillBtn}
            title="Зачеркнуть"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Sort */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] px-1 py-0.5 text-sm bg-[#2a2a2a]">
          <button
            onClick={() => onSortChange('new')}
            className={`px-2 py-1 rounded ${
              sortMode === 'new' ? 'bg-[#3a3a3a]' : 'hover:bg-[#333333]'
            }`}
          >
            Новые
          </button>
          <button
            onClick={() => onSortChange('old')}
            className={`px-2 py-1 rounded ${
              sortMode === 'old' ? 'bg-[#3a3a3a]' : 'hover:bg-[#333333]'
            }`}
          >
            Старые
          </button>
          <button
            onClick={() => onSortChange('top')}
            className={`px-2 py-1 rounded ${
              sortMode === 'top' ? 'bg-[#3a3a3a]' : 'hover:bg-[#333333]'
            }`}
          >
            Популярные
          </button>
        </div>
      </div>

      {!userId && (
        <div className="mb-2 text-sm text-[#9ca3af]">
          Войдите в систему, чтобы оставлять комментарии
        </div>
      )}

      {/* Reply indicator */}
      {replyTo && (
        <div className="mb-2 inline-flex items-center gap-2 text-sm text-[#9ca3af]">
          <CornerDownRight className="w-4 h-4" /> Ответ на #{replyTo.id.slice(0, 6)}…
          <button
            onClick={onReplyCancel}
            className="inline-flex items-center gap-1 text-xs opacity-80 hover:opacity-100"
          >
            <X className="w-3 h-3" /> отменить
          </button>
        </div>
      )}

      {/* Editor */}
      <div className="relative rounded-lg border bg-[#262626] border-[#2f2f2f]">
        {isEmpty && (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-[#9ca3af] opacity-60">
            {userId ? 'Напишите комментарий…' : 'Войдите, чтобы комментировать'}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable={!!userId}
          suppressContentEditableWarning
          className={`min-h-[64px] rounded-lg p-3 outline-none bg-[#262626] text-[#e5e7eb] ${
            !!userId ? '' : 'opacity-60'
          } focus-visible:ring-2 ring-white/10`}
          onInput={() => {
            const txt = editorRef.current?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
            setIsEmpty(txt.length === 0);
          }}
          onPaste={(e) => {
            if (!userId) return;
            e.preventDefault();
            const text = (e.clipboardData || (window as any).clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
          }}
          onKeyDown={(e) => {
            if (!userId) return;
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void sendComment();
            }
          }}
        />
      </div>

      {/* Controls */}
      <div className="mt-2 flex items-center justify-between">
        <label className={`inline-flex items-center gap-2 ${userId ? '' : 'opacity-50'}`}>
          <input
            type="checkbox"
            disabled={!userId}
            checked={asTeam}
            onChange={(e) => {
              setAsTeam(e.target.checked);
              if (!e.target.checked) setPinOnSend(false);
            }}
          />
          <span>От команды</span>
        </label>
        
        <label
          className={`inline-flex items-center gap-2 ${
            userId && asTeam ? '' : 'opacity-50'
          }`}
        >
          <input
            type="checkbox"
            disabled={!userId || !asTeam}
            checked={pinOnSend}
            onChange={(e) => setPinOnSend(e.target.checked)}
          />
          <span>Закрепить</span>
          {pinOnSend ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
        </label>
        
        <button
          onClick={sendComment}
          disabled={sending || !userId || isEmpty}
          className={sendBtn}
        >
          {sending ? 'Отправка…' : replyTo ? 'Ответить' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}