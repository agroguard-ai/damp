import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, EMULATE_USER_COOKIE_NAME } from '@/lib/proxy';

function parseJwtPayload(token: string): { globalRole?: string; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = parseJwtPayload(token);
    if (payload?.globalRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only SUPER_ADMIN can emulate users' }, { status: 403 });
    }

    const body = await req.json();
    const targetUserId = body.userId;

    const response = NextResponse.json({ success: true, emulatedUserId: targetUserId ?? null });

    if (targetUserId && typeof targetUserId === 'string') {
      const backendUrl = process.env.API_BASE_URL;
      if (backendUrl) {
        const checkRes = await fetch(`${backendUrl}/admin/users?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (checkRes.ok) {
          const raw = await checkRes.json();
          const users: Array<{ id: string; globalRole: string }> = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
              ? raw.data
              : [];
          const target = users.find((u) => u.id === targetUserId);
          if (target && target.globalRole === 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'No se puede emular a un usuario con rol SUPER_ADMIN' }, { status: 400 });
          }
        }
      }

      response.cookies.set({
        name: EMULATE_USER_COOKIE_NAME,
        value: targetUserId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    } else {
      response.cookies.delete(EMULATE_USER_COOKIE_NAME);
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error managing emulation session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
