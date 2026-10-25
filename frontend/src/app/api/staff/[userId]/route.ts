import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const body = await request.text();
  return proxyRequest(`/staff/${userId}`, {
    method: 'PATCH',
    body,
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return proxyRequest(`/staff/${userId}`, {
    method: 'DELETE',
  });
}
