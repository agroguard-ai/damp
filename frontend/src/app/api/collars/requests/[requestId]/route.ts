import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const body = await request.text();
  return proxyRequest(`/collars/requests/${requestId}`, {
    method: 'PATCH',
    body,
  });
}
