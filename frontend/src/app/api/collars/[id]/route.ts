import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/collars/${id}`);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.text();
  return proxyRequest(`/collars/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/collars/${id}`, {
    method: 'DELETE',
  });
}
