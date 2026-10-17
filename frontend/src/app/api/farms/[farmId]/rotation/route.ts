import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ farmId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { farmId } = await params;
  return proxyRequest(`/farms/${farmId}/rotation`);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { farmId } = await params;
  const body = await request.text();
  return proxyRequest(`/farms/${farmId}/rotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { farmId } = await params;
  return proxyRequest(`/farms/${farmId}/rotation`, {
    method: 'DELETE',
  });
}
