import { proxyRequest } from '@/lib/proxy';

export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return proxyRequest(`/admin/farms${search}`);
}
