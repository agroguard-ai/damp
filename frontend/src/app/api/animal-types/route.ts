import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyRequest(`/animal-types${search}`);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/animal-types', {
    method: 'POST',
    body,
  });
}
