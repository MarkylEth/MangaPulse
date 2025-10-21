// app/api/creator/[person]/titles/route.ts
export { GET } from '../../../people/[person]/titles/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';