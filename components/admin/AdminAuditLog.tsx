// components/admin/AdminAuditLog.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Clock, User, Activity, Filter, Search, 
  ChevronDown, ChevronUp, ExternalLink, RefreshCw,
  CheckCircle, XCircle, Trash2, Settings
} from 'lucide-react';
import { useTheme } from '@/lib/theme/context';

type AuditLog = {
  id: string;
  user_id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
  admin_username?: string;
};

type StatsData = {
  totalActions: number;
  actionsByType: Record<string, number>;
  topAdmins: Array<{ admin_id: string; username: string; count: number }>;
};

const ACTION_LABELS: Record<string, string> = {
  user_ban: 'Бан пользователя',
  user_unban: 'Разбан пользователя',
  role_change: 'Изменение роли',
  user_profile_update: 'Обновление профиля',
  reset_password: 'Сброс пароля',
  reset_password_link: 'Создание ссылки сброса',
  revoke_sessions: 'Отзыв сессий',
  manga_approve: 'Одобрение манги',
  manga_reject: 'Отклонение манги',
  chapter_approve: 'Одобрение главы',
  chapter_reject: 'Отклонение главы',
  comment_delete: 'Удаление комментария',
  comment_approve: 'Одобрение комментария',
  comment_moderation: 'Модерация комментария',
  comment_report_accept: 'Принятие жалобы',
  comment_report_reject: 'Отклонение жалобы',
  comment_report_delete: 'Удаление по жалобе',
  comment_report_pardon: 'Помилование',
  system_config_change: 'Изменение конфига',
  cache_refresh: 'Обновление кэша',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  user_ban: <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />,
  user_unban: <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />,
  role_change: <Shield className="w-4 h-4" />,
  user_profile_update: <User className="w-4 h-4" />,
  reset_password: <Shield className="w-4 h-4" />,
  reset_password_link: <ExternalLink className="w-4 h-4" />,
  revoke_sessions: <Shield className="w-4 h-4" />,
  manga_approve: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
  manga_reject: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
  chapter_approve: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
  chapter_reject: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
  comment_delete: <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />,
  comment_approve: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
  comment_moderation: <Shield className="w-4 h-4" />,
  comment_report_accept: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
  comment_report_reject: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
  comment_report_delete: <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />,
  comment_report_pardon: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
  system_config_change: <Settings className="w-4 h-4" />,
  cache_refresh: <RefreshCw className="w-4 h-4" />,
};

export function AdminAuditLog() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const textClass = 'text-black dark:text-white';
  const mutedClass = 'text-gray-600 dark:text-gray-400';
  const cardClass = 'rounded-xl bg-black/5 dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10';
  const inputClass = 'w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f1115] text-black dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50';

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/admin/audit-log?limit=100', { credentials: 'include' }),
        fetch('/api/admin/audit-log/stats', { credentials: 'include' })
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.items || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.event_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.event_type.toLowerCase().includes(q) ||
        log.admin_username?.toLowerCase().includes(q) ||
        log.ip_address?.toLowerCase().includes(q) ||
        JSON.stringify(log.metadata).toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          <span className={mutedClass}>Загрузка логов...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Логи действий</h1>
          <p className={mutedClass}>История действий администраторов и модераторов</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-3 mb-2">
              <Activity className={`w-5 h-5 ${textClass}`} />
              <h3 className={`font-semibold ${textClass}`}>Всего действий</h3>
            </div>
            <p className={`text-3xl font-bold ${textClass}`}>
              {stats.totalActions.toLocaleString('ru-RU')}
            </p>
          </div>

          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-3 mb-2">
              <Shield className={`w-5 h-5 ${textClass}`} />
              <h3 className={`font-semibold ${textClass}`}>Типов действий</h3>
            </div>
            <p className={`text-3xl font-bold ${textClass}`}>
              {Object.keys(stats.actionsByType).length}
            </p>
          </div>

          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-3 mb-2">
              <User className={`w-5 h-5 ${textClass}`} />
              <h3 className={`font-semibold ${textClass}`}>Активных админов</h3>
            </div>
            <p className={`text-3xl font-bold ${textClass}`}>
              {stats.topAdmins.length}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`${cardClass} p-4`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${textClass} mb-2`}>
              <Filter className="w-4 h-4 inline mr-2" />
              Тип действия
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={inputClass}
            >
              <option value="all">Все типы</option>
              {stats && Object.keys(stats.actionsByType).map(type => (
                <option key={type} value={type}>
                  {ACTION_LABELS[type] || type} ({stats.actionsByType[type]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${textClass} mb-2`}>
              <Search className="w-4 h-4 inline mr-2" />
              Поиск
            </label>
            <input
              type="text"
              placeholder="Поиск по администратору, IP, метаданным..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center">
              <p className={mutedClass}>Логи не найдены</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex items-center gap-2">
                        {ACTION_ICONS[log.event_type] || <Activity className="w-4 h-4" />}
                        <span className={`font-semibold ${textClass}`}>
                          {ACTION_LABELS[log.event_type] || log.event_type}
                        </span>
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${log.success ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                        {log.success ? '✓ Успешно' : '✗ Ошибка'}
                      </span>
                    </div>

                    <div className={`text-sm ${mutedClass} space-y-1`}>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.admin_username || log.user_id.substring(0, 8)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.created_at).toLocaleString('ru-RU')}
                        </span>
                        {log.ip_address && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                            IP: {log.ip_address}
                          </span>
                        )}
                        {log.metadata?.target_id && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                            ID: {log.metadata.target_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>

                      {log.error_reason && (
                        <div className="text-red-600 dark:text-red-400">
                          ⚠️ {log.error_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className={`p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 ${textClass}`}
                  >
                    {expandedId === log.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded metadata */}
                {expandedId === log.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 rounded-lg bg-black/5 dark:bg-white/5"
                  >
                    <h4 className={`text-sm font-semibold ${textClass} mb-2`}>Метаданные:</h4>
                    <pre className={`text-xs ${mutedClass} overflow-x-auto`}>
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                    {log.user_agent && (
                      <div className={`text-xs ${mutedClass} mt-2`}>
                        <strong>User Agent:</strong> {log.user_agent}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Pagination info */}
      <div className={`text-center text-sm ${mutedClass}`}>
        Показано {filteredLogs.length} из {logs.length} записей
      </div>
    </div>
  );
}