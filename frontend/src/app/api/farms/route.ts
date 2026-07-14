import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/farms');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/farms', {
    method: 'POST',
    body,
  });
}
