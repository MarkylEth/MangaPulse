//components/profile/ProfileTabs.tsx
'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle, XCircle, Heart, Clock } from 'lucide-react';
import type { CardItem, Status } from './types';

const MangaCard = dynamic(() => import('./MangaCard'));

const TABS = [
  { key: 'reading', title: 'Читаю', icon: BookOpen },
  { key: 'completed', title: 'Прочитано', icon: CheckCircle },
  { key: 'dropped', title: 'Брошено', icon: XCircle },
  { key: 'favorites', title: 'Любимое', icon: Heart },
  { key: 'planned', title: 'В планах', icon: Clock },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function ProfileTabs({
  theme,
  reading, completed, planned, dropped, favorites,
  getStatus, onSetStatus, onRemove,
  editable = false,
}: {
  theme: 'light' | 'dark';
  reading: CardItem[];
  completed: CardItem[];
  planned: CardItem[];
  dropped: CardItem[];
  favorites: CardItem[];
  getStatus: (id: number) => Status;
  onSetStatus: (item: CardItem, s: Exclude<Status, null>) => void;
  onRemove: (item: CardItem) => void;
  editable?: boolean;
}) {
  const [active, setActive] = useState<TabKey>('reading');

  const lists: Record<TabKey, CardItem[]> = { reading, completed, planned, dropped, favorites };
  const visible = useMemo(() => lists[active] ?? [], [active, lists]);

  return (
    <div className="space-y-6">
      {/* Tabs Navigation - pill style, no borders */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mx-2 px-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const count = lists[t.key].length;
            const isActive = active === t.key;
            
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`group relative flex items-center gap-2.5 px-5 py-3 rounded-full transition-all duration-300 whitespace-nowrap ${
                  isActive
                    ? 'bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg'
                    : 'hover:bg-muted/50'
                }`}
              >
                <Icon 
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  }`} 
                />
                
                <span className={`text-sm font-medium ${
                  isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`}>
                  {t.title}
                </span>
                
                {/* Count */}
                <span className={`text-xs font-bold min-w-[24px] h-6 flex items-center justify-center rounded-full ${
                  isActive 
                    ? 'bg-muted text-foreground' 
                    : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {visible.length === 0 ? (
        <div className="relative rounded-3xl overflow-hidden">
          {/* Empty state - no hard borders */}
          <div className="relative p-12 text-center bg-card/50 backdrop-blur-sm border border-border/30">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/10 via-transparent to-muted/10" />
            
            <div className="relative">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
                {(() => {
                  const Icon = TABS.find(t => t.key === active)?.icon ?? BookOpen;
                  return <Icon className="w-10 h-10 text-muted-foreground/40" />;
                })()}
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {active === 'reading' && 'Начните читать'}
                {active === 'completed' && 'Список пуст'}
                {active === 'dropped' && 'Всё идёт по плану'}
                {active === 'favorites' && 'Добавьте избранное'}
                {active === 'planned' && 'Составьте список'}
              </h3>
              
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {active === 'reading' && 'Тайтлы, которые вы читаете, появятся здесь'}
                {active === 'completed' && 'Завершённые работы будут отображаться в этом разделе'}
                {active === 'dropped' && 'Здесь нет брошенных тайтлов — и это хорошо!'}
                {active === 'favorites' && 'Отметьте сердечком лучшие работы'}
                {active === 'planned' && 'Добавьте тайтлы, которые планируете прочитать'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {visible.map((item) => (
            <MangaCard
              key={`${active}-${item.manga_id}`}
              item={item}
              theme={theme}
              currentStatus={getStatus(item.manga_id)}
              onSetStatus={(s) => onSetStatus(item, s)}
              onDelete={() => onRemove(item)}
              editable={editable}
            />
          ))}
        </div>
      )}
    </div>
  );
}