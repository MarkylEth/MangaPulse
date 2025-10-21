// components/entity/parts/EntityBanner.tsx
'use client';
import type { EntityLite } from '../types';

export default function EntityBanner({ entity }: { entity: EntityLite }) {
  return (
    <section className="rounded-2xl overflow-hidden bg-card border border-border/60">
      <div className="relative h-40 sm:h-56 bg-muted">
        {entity.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entity.banner_url}
            alt={entity.name}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute -bottom-10 left-6">
          <div className="w-24 h-24 rounded-2xl ring-2 ring-background overflow-hidden bg-muted shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entity.avatar_url ?? '/images/avatar-fallback.png'}
              alt={entity.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      <div className="pt-14 px-6 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{entity.name}</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-muted border border-border/60">
            {entity.entityType === 'creator' ? 'Создатель' : 'Издатель'}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {entity.socials?.site_url && (
            <a href={entity.socials.site_url} className="hover:underline" target="_blank">Сайт</a>
          )}
          {entity.socials?.x_url && (
            <a href={entity.socials.x_url} className="hover:underline" target="_blank">X</a>
          )}
          {entity.socials?.telegram && (
            <a href={entity.socials.telegram} className="hover:underline" target="_blank">Telegram</a>
          )}
          {entity.socials?.vk_url && (
            <a href={entity.socials.vk_url} className="hover:underline" target="_blank">VK</a>
          )}
        </div>
      </div>
    </section>
  );
}
