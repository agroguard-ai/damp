import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/admin/iot-logs/summary');
}
