import { NextResponse } from 'next/server';
import { getAuthToken, getEmulatedUserId } from '@/lib/proxy';

export async function GET() {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json({ user: null, emulatedUser: null }, { status: 401 });
    }

    const backendUrl = process.env.API_BASE_URL;
    if (!backendUrl) {
      return NextResponse.json({ error: 'API_BASE_URL is not configured' }, { status: 500 });
    }

    const backendRes = await fetch(`${backendUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!backendRes.ok) {
      return NextResponse.json({ user: null, emulatedUser: null }, { status: backendRes.status });
    }

    const user = await backendRes.json();
    let emulatedUser = null;

    const emulatedUserId = await getEmulatedUserId();
    if (emulatedUserId && user.globalRole === 'SUPER_ADMIN') {
      const emulatedRes = await fetch(`${backendUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-emulate-user-id': emulatedUserId,
        },
      });
      if (emulatedRes.ok) {
        emulatedUser = await emulatedRes.json();
      }
    }

    return NextResponse.json({ user, emulatedUser });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener sesión';
    return NextResponse.json({ message, user: null, emulatedUser: null }, { status: 500 });
  }
}
