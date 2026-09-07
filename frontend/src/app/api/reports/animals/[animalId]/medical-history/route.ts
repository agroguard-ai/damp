import { proxyFileDownload } from '@/lib/proxy';

export async function GET(_request: Request, { params }: { params: Promise<{ animalId: string }> }) {
  const { animalId } = await params;
  return proxyFileDownload(`/reports/animals/${animalId}/medical-history`);
}
