export function getIp(req: Request): string {
  const h = (req as any).headers as Headers;
  const xff = h.get('x-forwarded-for') || '';
  const ipFromXff = xff.split(',')[0]?.trim();
  return (
    ipFromXff ||
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    ''
  );
}
