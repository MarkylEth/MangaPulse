// components/entity/parts/EntityStats.tsx
'use client';
import type { EntityLite, TitleLink, RoleKey } from '../types';

export default function EntityStats({
  entity,
  titles,
  roleKeys,
}: {
  entity: EntityLite;
  titles: TitleLink[];
  roleKeys: RoleKey[];
}) {
  const total = titles.length;
  const perRole = new Map<string, number>();
  roleKeys.forEach(r => perRole.set(r, 0));
  titles.forEach(t => (t.roles ?? []).forEach(r => perRole.set(r, (perRole.get(r) ?? 0) + 1)));

  const firstYear = titles.reduce<number | null>((min, t) => {
    if (!t.year) return min;
    return min == null ? t.year : Math.min(min, t.year);
  }, null);

  return (
    <section className="rounded-2xl p-6 bg-card/80 backdrop-blur-sm border border-border/50 space-y-5">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Статистика
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Всего тайтлов" value={String(total)} />
        <Stat label="Начало работы" value={firstYear ? String(firstYear) : '—'} />
      </div>

      {roleKeys.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">По ролям</div>
          <div className="grid grid-cols-2 gap-2">
            {roleKeys.map((r) => (
              <BadgeLine key={r} label={ruRole(r)} value={perRole.get(r) ?? 0} />
            ))}
          </div>
        </div>
      )}

      {entity.created_at && (
        <div className="text-xs text-muted-foreground">
          На сайте с {new Date(entity.created_at).toLocaleDateString()}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3 bg-background/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function BadgeLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
      <span className="text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ruRole(r: string) {
  const map: Record<string, string> = {
    author: 'Автор',
    artist: 'Художник',
    writer: 'Сценарист',
    translator: 'Переводчик',
    publisher: 'Издатель',
  };
  return map[r] ?? r;
}
