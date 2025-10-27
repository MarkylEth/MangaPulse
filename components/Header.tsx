// components/Header.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, Plus, Home, User, LogOut, Sparkles, LayoutGrid } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useTheme } from '@/lib/theme/context';
import { ThemeToggle } from '@/components/ThemeToggle';
import AddTitleModal from '@/components/add-title/AddTitleModal';
import CreateTeamDialog from '@/components/teams/CreateTeamDialog';
import AddRelatedButton from '@/components/AddRelatedButton';
import { useAuth } from '@/components/auth/AuthProvider';

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

const ThemedLogo = ({ className = '' }: { className?: string }) => {
  const { theme } = useTheme();
  const src = '/logodark.png';
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
  sidebarOpen,
  onSidebarToggle,
}: HeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const { user, isGuest, setUser } = useAuth();

  const profileName = useMemo(() => {
    if (user?.username) return String(user.username);
    if (user?.display_name) return String(user.display_name);
    if (user?.email) return String(user.email).split('@')[0];
    return 'Гость';
  }, [user]);
  
  const displayName = useMemo(() => {
    if (user?.display_name) return String(user.display_name);
    if (user?.username) return String(user.username);
    if (user?.email) return String(user.email).split('@')[0];
    return 'Гость';
  }, [user]);

  const profileRole = (user as any)?.role ?? null;

  const [addTitleModalOpen, setAddTitleModalOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      setShowUserMenu(false);
    }
    if (showUserMenu) {
      document.addEventListener('click', onDocClick);
      return () => document.removeEventListener('click', onDocClick);
    }
  }, [showUserMenu]);

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

  useEffect(() => {
    setShowUserMenu(false);
    setCreateMenuOpen(false);
  }, [pathname]);

  const [searchLocal, setSearchLocal] = useState(searchQuery);
  useEffect(() => setSearchLocal(searchQuery), [searchQuery]);
  useEffect(() => {
    const id = setTimeout(() => onSearchChange?.(searchLocal), 250);
    return () => clearTimeout(id);
  }, [searchLocal, onSearchChange]);

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

  const currentMangaId = useMemo(() => {
    const m = pathname?.match(/^\/manga\/(\d+)/i);
    return m ? Number(m[1]) : null;
  }, [pathname]);
  const canAddRelated = (profileRole === 'moderator' || profileRole === 'admin') && currentMangaId != null;

  return (
    <>
      <header className="backdrop-blur-md border-b border-zinc-800/50 bg-zinc-950/80 sticky top-0 z-50">
        {/* Ambient glow effect */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-1/3 w-64 h-32 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/3 w-64 h-32 bg-blue-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto px-3 sm:px-6 max-w-[1600px]">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-4 py-3">
            {/* Left */}
            <div className="flex items-center gap-2 sm:gap-3">
              {onSidebarToggle && (
                <motion.button
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  onClick={onSidebarToggle}
                  className="p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-zinc-700 transition-all backdrop-blur-sm"
                  aria-label="Открыть меню"
                >
                  <Menu className="w-4 h-4 text-zinc-300" />
                </motion.button>
              )}
              <Link href="/" className="flex items-center" aria-label="На главную">
                <ThemedLogo />
              </Link>
            </div>

            {/* Center - Search */}
            {showSearch ? (
              <div className="flex-1 max-w-2xl mx-auto">
                <div className="relative group">
                  <Link href="/catalog" className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                    <motion.button 
                      whileHover={{ scale: 1.02, y: -1 }} 
                      whileTap={{ scale: 0.98 }}
                      className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:via-blue-500 hover:to-cyan-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 overflow-hidden group/btn"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-700" />
                      <LayoutGrid className="w-4 h-4 relative z-10" />
                      <span className="hidden sm:block relative z-10 font-semibold">Каталог</span>
                    </motion.button>
                  </Link>
                  
                  <input
                    type="text"
                    placeholder="Поиск манги..."
                    value={searchLocal}
                    onChange={(e) => setSearchLocal(e.target.value)}
                    className="w-full rounded-xl pl-[110px] sm:pl-32 pr-12 py-3 border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-zinc-900/60"
                  />
                  
                  <motion.div
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    animate={{ scale: searchLocal ? [1, 1.1, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Search className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4">
                <Link href="/">
                  <motion.button 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 rounded-lg transition-all"
                  >
                    <Home className="w-4 h-4" />
                    <span className="hidden sm:block">Главная</span>
                  </motion.button>
                </Link>
                <Link href="/catalog">
                  <motion.button 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 rounded-lg transition-all"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:block">Каталог</span>
                  </motion.button>
                </Link>
              </div>
            )}

            {/* Right */}
            <div className="flex items-center gap-2">
              {canAddRelated && <AddRelatedButton mangaId={currentMangaId!} compact />}

              {/* Переключатель темы */}
              <ThemeToggle />

              {/* Create Menu */}
              <div className="relative" ref={createMenuRef}>
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCreateMenuOpen((v) => !v)}
                  className="relative p-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30" 
                  title="Создать"
                >
                  <Plus className="w-4 h-4 text-white" />
                  {createMenuOpen && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400"
                    />
                  )}
                </motion.button>

                <AnimatePresence>
                  {createMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.95 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800/50 bg-zinc-900/95 backdrop-blur-xl p-2 text-sm shadow-2xl shadow-black/50 z-50"
                    >
                      <button
                        onClick={() => { setCreateMenuOpen(false); setAddTitleModalOpen(true); }}
                        className="w-full rounded-lg px-3 py-2.5 text-left text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all flex items-center gap-2 group"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                        Предложить новый тайтл
                      </button>
                      <button
                        onClick={() => { setCreateMenuOpen(false); setTeamDialogOpen(true); }}
                        className="w-full rounded-lg px-3 py-2.5 text-left text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all flex items-center gap-2 group"
                      >
                        <User className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                        Создать команду
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile Menu */}
              <div className="relative">
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu((v) => !v); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-zinc-700 transition-all backdrop-blur-sm"
                >
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-300" />
                    {!isGuest && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-900"
                      />
                    )}
                  </div>
                  <span className="text-sm text-zinc-300 hidden sm:block font-medium">
                    {displayName}
                  </span>
                </motion.button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 mt-2 w-52 rounded-xl border border-zinc-800/50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 z-50 overflow-hidden"
                    >
                      <div className="p-2">
                        {!isGuest ? (
                          <>
                            <Link 
                              href={`/profile/${encodeURIComponent(profileName ?? 'user')}`} 
                              onClick={() => setShowUserMenu(false)}
                              className="block px-3 py-2.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-all"
                            >
                              Мой профиль
                            </Link>
                            <button 
                              onClick={handleLogout}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-all group"
                            >
                              <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-300" />
                              Выйти с аккаунта
                            </button>
                          </>
                        ) : (
                          <Link
                            href="/login"
                            onClick={() => setShowUserMenu(false)}
                            className="block w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-all"
                          >
                            Войти / Регистрация
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      <AddTitleModal open={addTitleModalOpen} onOpenChange={setAddTitleModalOpen} />
      {teamDialogOpen && <CreateTeamDialog onClose={() => setTeamDialogOpen(false)} />}
    </>
  );
}

export default Header;