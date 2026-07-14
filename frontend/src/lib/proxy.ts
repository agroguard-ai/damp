import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

function getBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error('API_BASE_URL environment variable is not set.');
  }
  return url;
}

export async function proxyRequest(path: string, init?: RequestInit): Promise<NextResponse> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = `${getBaseUrl()}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    const backendRes = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers ?? {}),
      },
    });

    if (backendRes.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = backendRes.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    const body = isJson ? await backendRes.json() : await backendRes.text();

    return NextResponse.json(body, { status: backendRes.status });
  } catch (err) {
    console.error(`[proxy] Error forwarding ${init?.method ?? 'GET'} ${url}:`, err);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 502 });
  }
}
