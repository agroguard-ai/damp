import { proxyRequest } from '@/lib/proxy';

export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return proxyRequest(`/admin/users${search}`);
}

export async function POST(req: Request) {
  const body = await req.json();
  return proxyRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}
