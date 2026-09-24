import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/animals/bulk/transfer-farm', {
    method: 'POST',
    body,
  });
}
