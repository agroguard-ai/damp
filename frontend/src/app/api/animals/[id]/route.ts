import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/animals/${id}`);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.text();
  return proxyRequest(`/animals/${id}`, {
    method: 'PATCH',
    body,
  });
}
