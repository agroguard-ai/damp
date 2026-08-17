import { proxyFileDownload } from '@/lib/proxy';

export async function GET(_request: Request, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  return proxyFileDownload(`/reports/farms/${farmId}/summary`);
}
