import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return proxyRequest(`/staff/${userId}/reset-password`, {
    method: 'POST',
  });
}
