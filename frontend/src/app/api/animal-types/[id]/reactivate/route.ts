import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return proxyRequest(`/animal-types/${id}/reactivate`, {
    method: 'PATCH',
  });
}
