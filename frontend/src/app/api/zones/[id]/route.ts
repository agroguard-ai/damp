import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

// In Next.js 15+, params is a Promise
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/zones/${id}`);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/zones/${id}`, {
    method: 'DELETE',
    headers: {},
  });
}
