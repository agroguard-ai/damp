import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/animal-types');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/animal-types', {
    method: 'POST',
    body,
  });
}
