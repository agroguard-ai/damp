import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyRequest(`/alerts/${id}/resolve`, { method: 'PATCH' });
}
