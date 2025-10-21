// lib/api/slug.ts
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // латиница+кириллица+цифры -> дефисы между словами
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function ensureHandleBase(name: string) {
  const s = slugify(name);
  return s || 'entity';
}
