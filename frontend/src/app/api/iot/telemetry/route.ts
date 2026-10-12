import { NextResponse } from 'next/server';

function getBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error('API_BASE_URL environment variable is not set.');
  }
  return url;
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key') || '';
  const body = await req.json().catch(() => ({}));

  const url = `${getBaseUrl()}/api/iot/telemetry`;

  try {
    const backendRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error('[proxy-iot] Error forwarding telemetry to backend:', err);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 502 });
  }
}
