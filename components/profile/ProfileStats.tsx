// components/profile/ProfileStats.tsx
'use client';

import { BookOpen, Heart, Clock, XCircle, CheckCircle, Calendar, Users, ChevronRight  } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProfileLite } from './types';
import { tryJson } from '@/lib/utils';

import { useTheme } from '@/lib/theme/context';
import { roleLabel, getRoleColor, getRoleColorDark } from '@/lib/team/roles';

/* === Inline SVG brand icons === */
const TelegramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.099.154.232.17.326.016.093.036.305.02.471z"/>
  </svg>
);

const VKIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.066 14.122c.42.45.863.873 1.213 1.371.155.22.302.447.408.698.15.355.014.746-.308.767l-2.03.001c-.521.043-.938-.165-1.288-.515-.276-.276-.53-.571-.793-.858-.11-.12-.225-.233-.36-.323-.258-.172-.484-.122-.644.142-.162.267-.199.565-.218.867-.027.432-.211.545-.642.565-0.922.042-1.797-.098-2.614-.567-.711-.407-1.266-.976-1.75-1.628-0.943-1.27-1.662-2.66-2.303-4.096-.137-.308-.036-.475.295-.482.546-.012 1.092-.011 1.637-.001.222.004.37.131.463.338.372.827.815 1.607 1.382 2.302.152.186.307.373.515.502.23.143.407.095.516-.161.069-.162.098-.336.114-.511.053-.586.06-1.171-.022-1.753-.047-.341-.231-.562-.572-.634-.175-.037-.149-.11-.064-.221.135-.176.262-.286.514-.286h1.897c.299.059.366.193.407.494l.002 2.105c-.005.125.062.497.287.58.179.054.299-.083.406-.195.496-.52.85-1.148 1.161-1.797.137-.285.256-.583.372-.881.086-.22.221-.33.469-.325l2.19.003c.065 0 .131.001.194.015.357.079.455.276.341.618-.167.501-.494.915-.821 1.326-.347.436-.72.853-1.065 1.292-.315.401-.289.602.076.954z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const XIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
    <path d="M18.244 2H21l-6.52 7.457L22.5 22h-5.77l-4.51-5.89L6.1 22H3.344l6.98-7.968L1.5 2h5.86l4.06 5.39L18.244 2Zm-2.02 18h1.54L8.35 4h-1.6l9.474 16Z"/>
  </svg>
);

/* === helpers === */
function hostOf(url?: string) {
  if (!url) return '';
  try { return new URL(url).hostname; } catch { return ''; }
}

/* === Types === */
type Team = {
  id: number;
  name: string;
  slug?: string | null;
  avatar_url?: string | null;
};
type TeamMember = {
  team_id: number;
  team: Team;
  role: string;
};

type Props = {
  completed: number;
  reading: number;
  planned?: number;
  dropped?: number;
  favorites?: number;
  createdAt: string | null;
  favoriteGenres: string[] | null;
  profile?: ProfileLite | null;
};

export default function ProfileStats({
  completed,
  reading,
  planned = 0,
  dropped = 0,
  favorites = 0,
  createdAt,
  favoriteGenres,
  profile,
}: Props) {
  const { theme } = useTheme();
  const [teams, setTeams] = useState<TeamMember[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const hasSocials = !!(
    profile &&
    (profile.telegram || profile.x_url || profile.vk_url || profile.discord_url)
  );

  // ✅ ОПТИМИЗИРОВАННАЯ загрузка команд
  useEffect(() => {
    const username = profile?.username;
    
    if (!username) {
      setTeams([]);
      setLoadingTeams(false);
      return;
    }
    
    let cancelled = false;
    
    // Дебаунс на 150ms
    const timer = setTimeout(() => {
      setLoadingTeams(true);

      (async () => {
        try {
          const data = await tryJson([
            `/api/profile/${encodeURIComponent(username)}/teams`
          ]);
          
          if (!data) throw new Error('No data');

          const teamsList = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
            ? data
            : [];

          if (!cancelled) setTeams(teamsList);
        } catch (err) {
          console.error('[ProfileStats] Failed to load teams:', err);
          if (!cancelled) setTeams([]);
        } finally {
          if (!cancelled) setLoadingTeams(false);
        }
      })();
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile?.username]); // ✅ Зависимость напрямую от username

  return (
    <div className="sticky top-20 space-y-4">
      {/* Главная статистика — 3 сверху, 2 снизу */}
      <div className="rounded-2xl p-5 bg-card/80 backdrop-blur-sm border border-border/50">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Статистика
        </h3>

        {/* верхний ряд: 3 карточки (на мобильных — 2 в ряд) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          {/* Читаю */}
          <div className="group relative overflow-hidden rounded-xl p-4 bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all">
            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <BookOpen className="w-8 h-8 text-foreground" />
            </div>
            <div className="relative">
              <div className="text-2xl font-bold text-foreground mb-1">{reading}</div>
              <div className="text-xs text-muted-foreground">Читаю</div>
            </div>
          </div>

          {/* Прочитано */}
          <div className="group relative overflow-hidden rounded-xl p-4 bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all">
            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle className="w-8 h-8 text-foreground" />
            </div>
            <div className="relative">
              <div className="text-2xl font-bold text-foreground mb-1">{completed}</div>
              <div className="text-xs text-muted-foreground">Прочитано</div>
            </div>
          </div>

          {/* Брошено */}
          <div className="group relative overflow-hidden rounded-xl p-4 bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all">
            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <XCircle className="w-8 h-8 text-foreground" />
            </div>
            <div className="relative">
              <div className="text-2xl font-bold text-foreground mb-1">{dropped}</div>
              <div className="text-xs text-muted-foreground">Брошено</div>
            </div>
          </div>
        </div>

        {/* нижний ряд: 2 карточки */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
          {/* Любимое */}
          <div className="group relative overflow-hidden rounded-xl p-4 bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all">
            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Heart className="w-8 h-8 text-foreground" />
            </div>
            <div className="relative">
              <div className="text-2xl font-bold text-foreground mb-1">{favorites}</div>
              <div className="text-xs text-muted-foreground">Любимое</div>
            </div>
          </div>

          {/* В планах */}
          <div className="group relative overflow-hidden rounded-xl p-4 bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all">
            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock className="w-8 h-8 text-foreground" />
            </div>
            <div className="relative">
              <div className="text-2xl font-bold text-foreground mb-1">{planned}</div>
              <div className="text-xs text-muted-foreground">В планах</div>
            </div>
          </div>
        </div>
      </div>

      {/* С нами (полная дата) */}
      <div className="rounded-2xl p-5 bg-card/80 backdrop-blur-sm border border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
              С нами
            </div>
            <div className="text-sm font-medium text-foreground">
              {createdAt
                ? new Date(createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Неизвестно'}
            </div>
          </div>
        </div>
      </div>

      {/* В команде: 2 карточки в строке */}
      {loadingTeams ? (
  <div className="rounded-2xl p-5 bg-card/80 backdrop-blur-sm border border-border/50">
    <div className="flex items-center gap-2 mb-4">
      <Users className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        В команде
      </h3>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-[72px] rounded-2xl bg-muted/30 border border-border/30 animate-pulse" />
      ))}
    </div>
  </div>
) : teams.length > 0 ? (
  <div className="rounded-2xl p-5 bg-card/80 backdrop-blur-sm border border-border/50">
    <div className="flex items-center gap-2 mb-4">
      <Users className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        В команде
      </h3>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {teams.map((tm) => {
        const label = roleLabel(tm.role) || tm.role;
        const badgeColors = theme === 'light' ? getRoleColor(tm.role) : getRoleColorDark(tm.role);

        return (
          <a
            key={tm.team_id}
            href={`/team/${tm.team.slug ?? tm.team.id}`}
            className="
              group relative flex items-center gap-4 p-3 rounded-2xl
              bg-gradient-to-b from-muted/40 to-muted/20
              border border-border/50 hover:border-border
              transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
              focus:outline-none focus:ring-2 focus:ring-indigo-500/40
            "
          >
            {/* Аватар команды */}
            <div
              className="
                w-12 h-12 rounded-xl overflow-hidden shrink-0 grid place-items-center
                bg-muted border border-border/50
                ring-2 ring-transparent group-hover:ring-indigo-400/60
                transition-all
              "
            >
              {tm.team.avatar_url ? (
                <img src={tm.team.avatar_url} alt={tm.team.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            {/* Текст */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {tm.team.name}
              </div>
              <div
                className={`mt-1 inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-sm ${badgeColors}`}
              >
                {label}
              </div>
            </div>

            {/* Стрелка */}
            <ChevronRight
              className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-80 transition-opacity"
              aria-hidden="true"
            />

            {/* Декоративный подсвет на ховер */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-indigo-500/20" />
          </a>
        );
      })}
    </div>
  </div>
) : null}

      {/* Favorite Genres */}
      {favoriteGenres && favoriteGenres.length > 0 && (
        <div className="rounded-2xl p-5 bg-card/80 backdrop-blur-sm border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Любимые жанры
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {favoriteGenres.map((g) => (
              <span
                key={g}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted/50 border border-border/50 text-foreground hover:bg-muted hover:border-border transition-all cursor-default"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Social Links */}
      {hasSocials && (
        <div className="rounded-2xl p-5 bg-card/80 backdrop-blur-sm border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Социальные сети
            </h3>
          </div>

          <div className="space-y-2">
            {profile?.telegram && (
              <a
                href={`https://t.me/${profile.telegram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-[#0088cc] text-white flex items-center justify-center shrink-0">
                  <TelegramIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Telegram</div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{profile.telegram.replace('@', '')}
                  </div>
                </div>
              </a>
            )}

            {profile?.x_url && (
              <a
                href={profile.x_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                  <XIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">X (Twitter)</div>
                  <div className="text-xs text-muted-foreground truncate">{hostOf(profile.x_url)}</div>
                </div>
              </a>
            )}

            {profile?.vk_url && (
              <a
                href={profile.vk_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-[#0077FF] text-white flex items-center justify-center shrink-0">
                  <VKIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">VK</div>
                  <div className="text-xs text-muted-foreground truncate">{hostOf(profile.vk_url)}</div>
                </div>
              </a>
            )}

            {profile?.discord_url && (
              <a
                href={profile.discord_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted hover:border-border transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-[#5865F2] text-white flex items-center justify-center shrink-0">
                  <DiscordIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Discord</div>
                  <div className="text-xs text-muted-foreground truncate">{hostOf(profile.discord_url)}</div>
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Glow */}
      <div className="relative pointer-events-none opacity-20">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-32 h-32 bg-foreground/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
