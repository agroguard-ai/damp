import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  return proxyRequest(`/farms/${farmId}`);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const body = await request.text();
  return proxyRequest(`/farms/${farmId}`, {
    method: 'PATCH',
    body,
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return proxyRequest(`/farms/${farmId}${query ? `?${query}` : ''}`, {
    method: 'DELETE',
  });
}
