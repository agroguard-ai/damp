import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ farmId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { farmId } = await params;
  const body = await request.text();
  return proxyRequest(`/farms/${farmId}/rotation/postpone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
