'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Users,
  BookOpen,
  ClipboardList,
  MessageSquare,
  Settings,
  ChevronRight,
  Shield,
  FileCheck2,
} from 'lucide-react';
import { useTheme } from '@/lib/theme/context';
import { Header } from '@/components/Header';

// секции админки
import { AdminStats } from './AdminStats';
import UserManagement from './UserManagement';
import MangaManagement from './MangaManagement';
import CommentModeration from './CommentModeration';
import { SystemSettings } from './SystemSettings';
import TitleSuggestionsPanel from './TitleSuggestions';
import ChapterReviewPanel from '@/app/(admin)/admin/ChapterReviewPanel';

// добавили 'reviews'
type AdminSection =
  | 'dashboard'
  | 'users'
  | 'manga'
  | 'reviews'
  | 'edits'
  | 'comments'
  | 'settings';

export default function AdminDashboard() {
  const { theme } = useTheme();
  const pathname = usePathname();

  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageBg = 'bg-white text-black dark:bg-[#0f0f0f] dark:text-white';
  const textClass = 'text-black dark:text-white';
  const mutedText = 'text-gray-600 dark:text-gray-400';

  // === БАЗОВЫЕ КАРТОЧКИ/БОКСЫ ===
  const card =
    'rounded-xl bg-black/5 dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10';

  // === ССЫЛКИ/КНОПКИ В САЙДБАРЕ (нейтральные, без резких цветов) ===
  const navBase =
    'group flex items-center justify-between w-full rounded-xl border border-transparent p-3 transition-all';
  const navIdle =
    'hover:bg-black/5 dark:hover:bg-white/10';
  const navActive =
    'bg-black/10 dark:bg-white/10';

  const menu: Array<{
    key: AdminSection;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    { key: 'dashboard', title: 'Обзор', desc: 'Статистика', icon: <Activity className="h-5 w-5" /> },
    { key: 'users', title: 'Пользователи', desc: 'Аккаунты', icon: <Users className="h-5 w-5" /> },
    { key: 'manga', title: 'Манга', desc: 'Управление контентом', icon: <BookOpen className="h-5 w-5" /> },
    { key: 'reviews', title: 'Приёмка глав', desc: 'Одобрение/отклонение', icon: <FileCheck2 className="h-5 w-5" /> },
    { key: 'edits', title: 'Правки', desc: 'Заявки на правки', icon: <ClipboardList className="h-5 w-5" /> },
    { key: 'comments', title: 'Комментарии', desc: 'Модерация', icon: <MessageSquare className="h-5 w-5" /> },
    { key: 'settings', title: 'Настройки', desc: 'Параметры системы', icon: <Settings className="h-5 w-5" /> },
  ];

  function renderContent() {
    switch (activeSection) {
      case 'dashboard':
        return <AdminStats />;
      case 'users':
        return <UserManagement />;
      case 'manga':
        return <MangaManagement />;
      case 'reviews':
        return <ChapterReviewPanel />;
      case 'edits':
        return <TitleSuggestionsPanel />;
      case 'comments':
        return <CommentModeration />;
      case 'settings':
        return <SystemSettings />;
      default:
        return null;
    }
  }

  const Sidebar = (
    <aside className="space-y-3">
      <div className={`text-xl font-semibold ${textClass}`}>Админ панель</div>

      <nav className="space-y-2">
        {menu.map((item) => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                setActiveSection(item.key);
                setSidebarOpen(false);
              }}
              className={`${navBase} ${navIdle} ${isActive ? navActive : ''}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${theme === 'light' ? 'border-black/10 bg-white' : 'border-white/10 bg-white/5'}`}
                >
                  {item.icon}
                </span>
                <div className="text-left">
                  <div className="font-semibold">{item.title}</div>
                  <div className={`text-xs ${mutedText}`}>{item.desc}</div>
                </div>
              </div>
              <ChevronRight
                className={`h-4 w-4 transition-transform ${isActive ? 'translate-x-0 opacity-100' : 'translate-x-1 opacity-60 group-hover:opacity-100'}`}
              />
            </button>
          );
        })}
      </nav>

      <div className={`${card} p-3`}>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <div className="text-sm font-medium">Системная информация</div>
        </div>
        <div className={`mt-2 text-xs ${mutedText}`}>Правки во вкладке "Манга" не принимаем!</div>
      </div>
    </aside>
  );

  return (
    <div key={pathname} className={`min-h-screen ${pageBg}`}>
      <Header
        showSearch={false}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((s) => !s)}
      />

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <div className="hidden lg:block">{Sidebar}</div>

          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-40">
              {/* затемнение */}
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              {/* выезжающая панель — стили модалки/карточки из референса */}
              <div className={`absolute left-0 top-0 h-full w-[80%] max-w-[320px] p-4`}>
                <div className={`${card} h-full p-4 overflow-y-auto`}>
                  {Sidebar}
                </div>
              </div>
            </div>
          )}

          {/* Контент: без логических изменений */}
          <main className={`min-h-[60vh] ${card} p-4`}>
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}