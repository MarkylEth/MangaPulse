// components/news/parts.tsx
'use client';
import React from 'react';
import { User } from 'lucide-react';

export type Role = 'admin' | 'moderator' | 'user' | null;

export const fmtDate = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
export function safeDateLabel(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isFinite(+d) ? fmtDate.format(d) : '—';
}

export function AvatarImg({ src, size = 28 }: { src?: string | null; size?: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src} alt="" className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer" loading="lazy" decoding="async"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[rgb(var(--muted))]">
          <User className="w-1/2 h-1/2 opacity-70" />
        </div>
      )}
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  if (role !== 'admin' && role !== 'moderator') return null;
  const cfg =
    role === 'admin'
      ? { label: 'Админ', cls: 'bg-red-500/10 text-red-500 border-red-500/20' }
      : { label: 'Модер', cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-400/20' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-md border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/** Урезает HTML до текста-превью */
export function stripHtmlToText(html: string, max = 220): string {
  const withNewlines = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|pre|ul|ol)>/gi, '\n');
  const text = withNewlines
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+[^ \n]*$/, '') + '…';
}
