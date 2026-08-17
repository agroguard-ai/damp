import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ farmId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { farmId } = await params;
  return proxyRequest(`/farms/${farmId}/alert-settings`);
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { farmId } = await params;
  const body = await request.text();
  return proxyRequest(`/farms/${farmId}/alert-settings`, {
    method: 'PUT',
    body,
  });
}
