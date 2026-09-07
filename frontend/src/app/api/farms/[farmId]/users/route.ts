import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  return proxyRequest(`/farms/${farmId}/users`);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const body = await request.text();
  return proxyRequest(`/farms/${farmId}/users`, {
    method: 'POST',
    body,
  });
}
