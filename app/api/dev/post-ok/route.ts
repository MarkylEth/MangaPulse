if (process.env.NODE_ENV === "production") {
  export const GET    = () => new Response("Not available", { status: 404 });
  export const POST   = GET; export const PUT = GET; export const DELETE = GET; export const PATCH = GET;
}
export const dynamic = 'force-dynamic';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, method: 'GET' }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

export async function POST() {
  return new Response(JSON.stringify({ ok: true, method: 'POST' }), {
    status: 201,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

