// components/profile/ProfileBanner.tsx
'use client';
import { ProfileLite } from './types';
import { MessageCircle, Edit3 } from 'lucide-react';

export default function ProfileBanner({
  profile, canEdit, onEdit,
}: {
  profile: ProfileLite;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/50 shadow-lg">
      {/* Banner */}
      <div className="h-48 sm:h-60 md:h-72 relative">
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt="banner"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-muted/40 via-muted/30 to-muted/20 relative overflow-hidden">
            <div className="absolute top-0 left-1/3 w-96 h-96 bg-foreground/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-foreground/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6 sm:px-8 py-5 sm:py-6 flex items-start justify-between gap-6 bg-card flex-wrap">
        <div className="flex items-center gap-5 sm:gap-6 min-w-0 flex-1">
          {/* Avatar */}
          <div className="-mt-20 sm:-mt-24">
            <div className="relative group">
              <div className="absolute inset-0 bg-muted/40 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-32 w-32 sm:h-36 sm:w-36 overflow-hidden rounded-3xl bg-background ring-4 ring-background shadow-2xl border border-border/50">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-4xl sm:text-5xl bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
                    ☻
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name & Username (поднято выше) */}
          <div className="min-w-0 -mt-1 sm:-mt-2 pt-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-0.5 tracking-tight truncate">
              {(profile.full_name ?? '').trim() || profile.username}
            </h1>
            <div className="text-sm sm:text-base text-muted-foreground">
              @{profile.username}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 flex gap-2 sm:gap-3">
          {canEdit ? (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-muted hover:bg-muted/80 border border-border text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md"
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Редактировать профиль</span>
              <span className="sm:hidden">Редактировать</span>
            </button>
          ) : (
            <>
              <button
                className="inline-flex items-center justify-center p-2.5 sm:p-3 bg-muted hover:bg-muted/80 border border-border rounded-xl sm:rounded-2xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md"
                aria-label="Отправить сообщение"
              >
                <MessageCircle className="w-5 h-5 text-foreground" />
              </button>
              <button className="px-4 sm:px-5 py-2.5 sm:py-3 bg-foreground text-background hover:opacity-90 text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md">
                Подписаться
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
