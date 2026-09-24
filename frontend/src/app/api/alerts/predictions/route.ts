import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyRequest(`/alerts/predictions${search}`);
}
