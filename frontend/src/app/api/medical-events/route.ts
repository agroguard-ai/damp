import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyRequest(`/medical-events${search}`);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/medical-events', {
    method: 'POST',
    body,
  });
}
