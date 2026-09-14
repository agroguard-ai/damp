import { proxyRequest } from '@/lib/proxy';

export async function GET(_request: Request, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  return proxyRequest(`/reports/farms/${farmId}/dashboard`);
}
