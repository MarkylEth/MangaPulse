//components/admin/AdminStats.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, BookOpen, MessageSquare, Eye, Activity, Award } from 'lucide-react';
import { useTheme } from '@/lib/theme/context';

type StatsData = {
  totalUsers: number;
  totalManga: number;
  totalChapters: number;
  totalComments: number;
  recentUsers: number;
  pendingManga: number;
  todayViews: number;
  totalViews: number;
};

const DEFAULT_STATS: StatsData = {
  totalUsers: 0,
  totalManga: 0,
  totalChapters: 0,
  totalComments: 0,
  recentUsers: 0,
  pendingManga: 0,
  todayViews: 0,
  totalViews: 0,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function mergeStats(base: StatsData, incoming: unknown): StatsData {
  if (!isRecord(incoming)) return base;
  const next: StatsData = { ...base };
  (Object.keys(base) as (keyof StatsData)[]).forEach((k) => {
    const val = (incoming as any)[k];
    if (typeof val === 'number' && Number.isFinite(val)) {
      next[k] = val;
    }
  });
  return next;
}

export function AdminStats() {
  const { theme } = useTheme();
  const [stats, setStats] = useState<StatsData>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  const textClass = 'text-black dark:text-white';
  const mutedTextClass = 'text-gray-600 dark:text-gray-400';
  const cardClass =
    'rounded-xl bg-black/5 dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/stats', {
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        const text = await res.text();
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch {}

        if (res.ok && json && (json.ok === undefined || json.ok === true)) {
          const merged = mergeStats(DEFAULT_STATS, json.data ?? json);
          if (!cancelled) setStats(merged);
        } else {
          if (!cancelled) setStats(DEFAULT_STATS);
        }
      } catch (e) {
        console.error('Error fetching stats:', e);
        if (!cancelled) setStats(DEFAULT_STATS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const s = stats ?? DEFAULT_STATS;

  const statCards = [
    {
      title: 'Всего пользователей',
      value: s.totalUsers,
      icon: Users,
      change: `+${s.recentUsers} за неделю`,
      changeColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Манга в каталоге',
      value: s.totalManga,
      icon: BookOpen,
      change: `${s.pendingManga} на модерации`,
      changeColor: 'text-orange-600 dark:text-orange-400',
    },
    {
      title: 'Всего глав',
      value: s.totalChapters,
      icon: Award,
      change: 'Активный контент',
      changeColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Комментариев',
      value: s.totalComments,
      icon: MessageSquare,
      change: 'Вовлеченность',
      changeColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Просмотров сегодня',
      value: s.todayViews,
      icon: Eye,
      change: `${s.totalViews} всего`,
      changeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      title: 'Активность',
      value: '94%',
      icon: Activity,
      change: 'Система работает',
      changeColor: 'text-green-600 dark:text-green-400',
    },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          <span className={mutedTextClass}>Загрузка статистики...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Обзор системы</h1>
        <p className={mutedTextClass}>Статистика и аналитика платформы MangaPulse</p>
      </div>

      {/* карточки со статистикой */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className={`${cardClass} p-6`}
            >
              <div className="flex items-start justify-between mb-4">
                {/* нейтральный фон для иконки, как на референсе */}
                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/10 dark:bg-white/10">
                  <Icon className="w-6 h-6 text-black dark:text-white" />
                </div>
                <div className={`text-2xl font-bold ${textClass}`}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString('ru-RU') : stat.value}
                </div>
              </div>
              <div>
                <h3 className={`font-semibold ${textClass} mb-1`}>{stat.title}</h3>
                <p className={`text-sm ${stat.changeColor}`}>{stat.change}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* последняя активность */}
      <div className={`${cardClass} p-6`}>
        <div className="flex items-center gap-3 mb-6">
          <Activity className={`w-6 h-6 ${textClass}`} />
          <h2 className={`text-xl font-bold ${textClass}`}>Последняя активность</h2>
        </div>

        <div className="space-y-4">
          {[
            { action: 'Новый пользователь зарегистрировался', time: '5 минут назад' },
            { action: 'Загружена новая глава манги', time: '15 минут назад' },
            { action: 'Модерирован комментарий', time: '30 минут назад' },
            { action: 'Одобрена заявка на мангу', time: '1 час назад' },
          ].map((a) => (
            <div key={a.action} className="flex items-center justify-between">
              <div className={textClass}>{a.action}</div>
              <div className={mutedTextClass}>{a.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
