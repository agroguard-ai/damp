import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const body = await request.text();
  return proxyRequest(`/collars/claims/${claimId}`, {
    method: 'PATCH',
    body,
  });
}
