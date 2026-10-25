import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/staff');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/staff', {
    method: 'POST',
    body,
  });
}
