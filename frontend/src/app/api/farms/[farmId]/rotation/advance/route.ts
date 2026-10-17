import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ farmId: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { farmId } = await params;
  return proxyRequest(`/farms/${farmId}/rotation/advance`, {
    method: 'POST',
  });
}
