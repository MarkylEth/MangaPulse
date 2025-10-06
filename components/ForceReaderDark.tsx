// components/ForceReaderDark.tsx
'use client';

import { useEffect } from 'react';

export default function ForceReaderDark({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // запомним прошлые значения, чтобы аккуратно вернуть при размонтировании
    const html = document.documentElement;
    const prevColorScheme = html.style.colorScheme;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlClass = html.className;

    // жёстко включаем тёмный режим и чёрный фон
    html.classList.add('dark');              // если Tailwind dark-variant
    html.style.colorScheme = 'dark';
    document.body.style.backgroundColor = '#000';

    return () => {
      // вернём как было
      html.style.colorScheme = prevColorScheme;
      html.className = prevHtmlClass;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  // сам контейнер страницы — на весь экран, чёрный
  return (
    <div className="min-h-screen w-full bg-black text-white">
      {children}
    </div>
  );
}
