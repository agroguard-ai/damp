import { proxyRequest } from '@/lib/proxy';

export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return proxyRequest(`/admin/iot-logs${search}`);
}

export async function DELETE() {
  return proxyRequest(`/admin/iot-logs/clear`, { method: 'DELETE' });
}
