import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'damp_token';
export const EMULATE_USER_COOKIE_NAME = 'damp_emulate_user_id';

function getBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error('API_BASE_URL environment variable is not set.');
  }
  return url;
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getEmulatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(EMULATE_USER_COOKIE_NAME)?.value ?? null;
}

export async function proxyRequest(path: string, init?: RequestInit): Promise<NextResponse> {
  const token = await getAuthToken();
  const emulatedUserId = await getEmulatedUserId();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = `${getBaseUrl()}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (emulatedUserId) {
    headers['x-emulate-user-id'] = emulatedUserId;
  }

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

/** Como proxyRequest, pero para descargas binarias (PDF/Excel): reenvía bytes crudos sin pasar por JSON. */
export async function proxyFileDownload(path: string): Promise<NextResponse> {
  const token = await getAuthToken();
  const emulatedUserId = await getEmulatedUserId();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = `${getBaseUrl()}${path}`;

  const reqHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (emulatedUserId) {
    reqHeaders['x-emulate-user-id'] = emulatedUserId;
  }

  try {
    const backendRes = await fetch(url, {
      headers: reqHeaders,
    });

    if (!backendRes.ok) {
      const body = await backendRes.text();
      return new NextResponse(body, { status: backendRes.status });
    }

    const buffer = await backendRes.arrayBuffer();
    const headers = new Headers();
    const contentType = backendRes.headers.get('content-type');
    const contentDisposition = backendRes.headers.get('content-disposition');
    if (contentType) headers.set('content-type', contentType);
    if (contentDisposition) headers.set('content-disposition', contentDisposition);

    return new NextResponse(buffer, { status: 200, headers });
  } catch (err) {
    console.error(`[proxy] Error forwarding file download GET ${url}:`, err);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 502 });
  }
}
