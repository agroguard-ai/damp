import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/collars/requests');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/collars/requests', {
    method: 'POST',
    body,
  });
}
