import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ farmId: string; userId: string }> }) {
  const { farmId, userId } = await params;
  const body = await request.text();
  return proxyRequest(`/farms/${farmId}/users/${userId}`, {
    method: 'PATCH',
    body,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ farmId: string; userId: string }> }
) {
  const { farmId, userId } = await params;
  return proxyRequest(`/farms/${farmId}/users/${userId}`, {
    method: 'DELETE',
  });
}
