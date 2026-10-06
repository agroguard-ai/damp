import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'damp_token';

const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/iot',
  '/arquitectura',
  '/architecture',
  '/architecture.html',
];

function parseJwtPayload(token: string): { mustChangePassword?: boolean; sub?: string } | null {
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

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirigir intentos directos a /sign-up hacia /sign-in
  if (pathname.startsWith('/sign-up')) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const isPublic = PUBLIC_PATHS.some((path) => (path === '/' ? pathname === '/' : pathname.startsWith(path)));
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Si tiene token, evaluar payload
  if (token) {
    const payload = parseJwtPayload(token);
    const mustChangePassword = Boolean(payload?.mustChangePassword);

    // Si debe cambiar la contraseña
    if (mustChangePassword) {
      const isAllowedWhileMustChange =
        pathname.startsWith('/change-password') ||
        pathname.startsWith('/api/auth/change-password') ||
        pathname.startsWith('/api/auth/logout');

      if (!isAllowedWhileMustChange) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Password change required', mustChangePassword: true }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/change-password', request.url));
      }

      return NextResponse.next();
    }

    // Si NO debe cambiar la contraseña e intenta acceder a /change-password o /sign-in
    if (pathname.startsWith('/change-password') || pathname.startsWith('/sign-in')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  // Si no está autenticado y la ruta no es pública
  if (!token && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
