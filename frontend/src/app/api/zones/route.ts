import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  // Forward farmId query param
  const search = request.nextUrl.search;
  return proxyRequest(`/zones${search}`);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/zones', {
    method: 'POST',
    body,
  });
}
