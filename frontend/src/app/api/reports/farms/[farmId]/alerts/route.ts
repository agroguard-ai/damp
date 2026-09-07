import { type NextRequest } from 'next/server';
import { proxyFileDownload } from '@/lib/proxy';

export async function GET(request: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const search = request.nextUrl.search;
  return proxyFileDownload(`/reports/farms/${farmId}/alerts${search}`);
}
