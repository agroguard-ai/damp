import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/proxy';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const backendUrl = process.env.API_BASE_URL;
    if (!backendUrl) {
      return NextResponse.json({ error: 'API_BASE_URL is not configured' }, { status: 500 });
    }

    const backendRes = await fetch(`${backendUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { message: data.message || 'Error al cambiar la contraseña' },
        { status: backendRes.status }
      );
    }

    const { accessToken, user } = data;

    const response = NextResponse.json({ user });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cambiar la contraseña';
    return NextResponse.json({ message }, { status: 500 });
  }
}
