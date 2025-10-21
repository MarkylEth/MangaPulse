import React from 'react';

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function newsToHtml(src: string): string {
  let s = escapeHtml(src);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // **bold**
  s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');               // ~~strike~~
  s = s.replace(/\[u\]([\s\S]+?)\[\/u\]/g, '<u>$1</u>');  // [u]underline[/u]
  s = s.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>'); // *italic*
  s = s.replace(/\|\|([\s\S]+?)\|\|/g,
    '<details class="spoiler"><summary>Спойлер</summary><div>$1</div></details>');
  s = s.replace(/\r\n|\r|\n/g, '<br/>');
  return s;
}

export default function NewsBody({ text }: { text: string }) {
  return <div dangerouslySetInnerHTML={{ __html: newsToHtml(text) }} />;
}
