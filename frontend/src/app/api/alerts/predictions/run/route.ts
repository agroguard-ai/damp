import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyRequest('/alerts/predictions/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
