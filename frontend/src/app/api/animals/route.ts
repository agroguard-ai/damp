import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyRequest(`/animals${search}`);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/animals', {
    method: 'POST',
    body,
  });
}
