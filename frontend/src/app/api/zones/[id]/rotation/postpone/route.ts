import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.text();
  return proxyRequest(`/zones/${id}/rotation/postpone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
