// components/Header.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Menu, Grid3X3, Plus, Home, User, LogOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useTheme } from '@/lib/theme/context';
import { ThemeToggle } from '@/components/ThemeToggle';
import AuthModal from '@/components/auth/AuthModal';
import AddTitleModal from '@/components/AddTitleModal';
import CreateTeamDialog from '@/components/teams/CreateTeamDialog';
import AddRelatedButton from '@/components/AddRelatedButton';
import { useAuth } from '@/components/auth/AuthProvider';

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  /** ← вернули, чтобы не падали страницы, где он пробрасывается */
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

const ThemedLogo = ({ className = '' }: { className?: string }) => {
  const { theme } = useTheme();
  const src = theme === 'light' ? '/logo.png' : '/logodark.png';
  return (
    <motion.div
      className={`origin-left inline-block select-none ${className}`}
      initial={{ rotate: 0 }}
      whileHover={{ rotate: -6 }}
      whileTap={{ rotate: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
    >
      <Image src={src} alt="MangaPulse" width={500} height={500} priority className="w-auto h-5 sm:h-5 md:h-8" />
    </motion.div>
  );
};

export function Header({
  searchQuery = '',
  onSearchChange,
  showSearch = true,
  sidebarOpen,            // ← просто принимаем; сейчас внутри не используем
  onSidebarToggle,
}: HeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const { user, isGuest, setUser } = useAuth();

  const profileName = useMemo(() => {
    if (user?.nickname) return user.nickname as string;
    if (user?.email) return String(user.email).split('@')[0];
    return null;
  }, [user]);

  const profileRole = (user as any)?.role ?? null;

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addTitleModalOpen, setAddTitleModalOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  // закрытие меню профиля по клику вне (без capture)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      // просто закрываем; это выполнится ПОСЛЕ onClick элементов меню
      setShowUserMenu(false);
    }
    if (showUserMenu) {
      document.addEventListener('click', onDocClick);            // ← без capture
      return () => document.removeEventListener('click', onDocClick);
    }
  }, [showUserMenu]);

  // закрытие меню “создать” по клику вне
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!createMenuRef.current) return;
      if (!createMenuRef.current.contains(e.target as Node)) setCreateMenuOpen(false);
    }
    if (createMenuOpen) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [createMenuOpen]);

  // смена маршрута — закрываем выпадашки
  useEffect(() => {
    setShowUserMenu(false);
    setCreateMenuOpen(false);
  }, [pathname]);

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white';

  // поиск
  const [searchLocal, setSearchLocal] = useState(searchQuery);
  useEffect(() => setSearchLocal(searchQuery), [searchQuery]);
  useEffect(() => {
    const id = setTimeout(() => onSearchChange?.(searchLocal), 250);
    return () => clearTimeout(id);
  }, [searchLocal, onSearchChange]);

  // logout
  async function handleLogout() {
    setShowUserMenu(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
    try { localStorage.removeItem('mp:user'); sessionStorage.removeItem('mp:user'); } catch {}
    router.push('/');
    router.refresh();
  }

  // ID манги из URL — для кнопки "Добавить связанное"
  const currentMangaId = useMemo(() => {
    const m = pathname?.match(/^\/manga\/(\d+)/i);
    return m ? Number(m[1]) : null;
  }, [pathname]);
  const canAddRelated = (profileRole === 'moderator' || profileRole === 'admin') && currentMangaId != null;

  return (
    <>
      <header className={`backdrop-blur-sm border-b sticky top-0 z-50 ${theme === 'light' ? 'bg-white/90 border-gray-200' : 'bg-slate-800/50 border-slate-700'}`}>
        <div className="mx-auto px-3 sm:px-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
            {/* Left */}
            <div className="flex items-center gap-3">
              {onSidebarToggle && (
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={onSidebarToggle}
                  className={`p-1.5 rounded-lg transition-colors ${theme==='light'?'bg-gray-100 hover:bg-gray-200':'bg-slate-700 hover:bg-slate-600'}`}
                  aria-label="Открыть меню"
                >
                  <Menu className={`w-4 h-4 ${textClass}`} />
                </motion.button>
              )}
              <Link href="/" className="flex items-center" aria-label="На главную"><ThemedLogo /></Link>
            </div>

            {/* Center - Search */}
            {showSearch ? (
              <div className="flex-1 max-w-2xl mx-auto">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                    <Link href="/catalog">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors">
                        <Grid3X3 className="w-4 h-4" /> Каталог
                      </motion.button>
                    </Link>
                  </div>
                  <input
                    type="text"
                    placeholder="   Поиск манги..."
                    value={searchLocal}
                    onChange={(e) => setSearchLocal(e.target.value)}
                    className={`w-full rounded-lg pl-28 pr-12 py-3 border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      theme==='light'?'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500':'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                    }`}
                  />
                  <Search className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme==='light'?'text-gray-400':'text-slate-400'}`} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-4">
                <Link href="/">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors ${theme==='light'?'text-gray-600 hover:text-gray-900':'text-slate-300 hover:text-white'}`}>
                    <Home className="w-4 h-4" /><span className="hidden sm:block">Главная</span>
                  </motion.button>
                </Link>
                <Link href="/catalog">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors ${theme==='light'?'text-gray-600 hover:text-gray-900':'text-slate-300 hover:text-white'}`}>
                    <Grid3X3 className="w-4 h-4" /><span className="hidden sm:block">Каталог</span>
                  </motion.button>
                </Link>
              </div>
            )}

            {/* Right */}
            <div className="flex items-center gap-2">
              {canAddRelated && <AddRelatedButton mangaId={currentMangaId!} compact />}

              <ThemeToggle />

              {/* "+" */}
              <div className="relative" ref={createMenuRef}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setCreateMenuOpen((v) => !v)}
                  className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 transition-colors" title="Создать">
                  <Plus className="w-4 h-4 text-white" />
                </motion.button>

                {createMenuOpen && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className={`absolute right-0 mt-2 w-56 rounded-2xl border p-2 text-sm shadow-xl z-50 ${
                      theme==='light'?'bg-white border-gray-200':'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => { setCreateMenuOpen(false); setAddTitleModalOpen(true); }}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${theme==='light'?'hover:bg-slate-100':'hover:bg-slate-700/60 text-slate-200'}`}
                    >
                      Предложить новый тайтл
                    </button>
                    <button
                      onClick={() => { setCreateMenuOpen(false); setTeamDialogOpen(true); }}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${theme==='light'?'hover:bg-slate-100':'hover:bg-slate-700/60 text-slate-200'}`}
                    >
                      Создать команду
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Профиль */}
              <div className="relative">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu((v) => !v); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${theme==='light'?'bg-gray-100 hover:bg-gray-200':'bg-slate-700 hover:bg-slate-600'}`}
                >
                  <User className={`w-4 h-4 ${textClass}`} />
                  <span className={`text-sm hidden sm:block ${textClass}`}>{profileName ?? 'Гость'}</span>
                </motion.button>

                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    onMouseDown={(e) => e.stopPropagation()}   // ← чтобы закрывалка «снаружи» не съедала клик
                    onClick={(e) => e.stopPropagation()}       // ← и на всякий случай
                    className={`absolute right-0 mt-2 w-52 rounded-lg border shadow-lg z-50 ${theme==='light'?'bg-white border-gray-200':'bg-slate-800 border-slate-700'}`}
                  >
                    <div className="py-2">
                      {!isGuest ? (
                        <>
                          <Link href={`/profile/${encodeURIComponent(profileName ?? 'user')}`} onClick={() => setShowUserMenu(false)}
                            className={`block px-4 py-2 text-sm transition-colors ${theme==='light'?'text-gray-700 hover:bg-gray-100':'text-slate-300 hover:bg-slate-700'}`}>
                            Мой профиль
                          </Link>
                          <button onClick={handleLogout}
                            className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${theme==='light'?'text-gray-700 hover:bg-gray-100':'text-slate-300 hover:bg-slate-700'}`}>
                            <LogOut className="w-4 h-4" /> Выйти с аккаунта
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setAuthModalOpen(true); setShowUserMenu(false); }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${theme==='light'?'text-gray-700 hover:bg-gray-100':'text-slate-300 hover:bg-slate-700'}`}
                        >
                          Войти / Регистрация
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Модалки (локальные для Header) */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <AddTitleModal open={addTitleModalOpen} onOpenChange={setAddTitleModalOpen} />
      {teamDialogOpen && <CreateTeamDialog onClose={() => setTeamDialogOpen(false)} />}
    </>
  );
}

export default Header;
