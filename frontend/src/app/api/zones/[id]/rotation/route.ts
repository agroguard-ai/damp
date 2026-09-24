import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/zones/${id}/rotation`);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.text();
  return proxyRequest(`/zones/${id}/rotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/zones/${id}/rotation`, {
    method: 'DELETE',
  });
}
