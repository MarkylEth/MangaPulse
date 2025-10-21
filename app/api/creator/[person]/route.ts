// app/api/creator/[person]/route.ts
export { GET } from '../../people/[person]/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

