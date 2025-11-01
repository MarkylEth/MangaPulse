//components/news/formatNews.tsx
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
  
  // Заменяем ||спойлер|| на элемент с blur-эффектом
  s = s.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler-blur">$1</span>');
  
  s = s.replace(/\r\n|\r|\n/g, '<br/>');
  return s;
}

export default function NewsBody({ text }: { text: string }) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!contentRef.current) return;

    // Обработчик клика на спойлеры
    const handleSpoilerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('spoiler-blur')) {
        target.classList.toggle('revealed');
      }
    };

    const container = contentRef.current;
    container.addEventListener('click', handleSpoilerClick);

    return () => {
      container.removeEventListener('click', handleSpoilerClick);
    };
  }, [text]);

  return (
    <div 
      ref={contentRef}
      dangerouslySetInnerHTML={{ __html: newsToHtml(text) }} 
    />
  );
}