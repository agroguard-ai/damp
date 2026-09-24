import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  return proxyRequest(`/collars/${id}/claims`, {
    method: 'POST',
    body,
  });
}
