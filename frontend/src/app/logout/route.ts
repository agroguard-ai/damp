import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, EMULATE_USER_COOKIE_NAME } from '@/lib/proxy';

export async function GET(request: Request) {
  const url = new URL('/sign-in', request.url);
  const response = NextResponse.redirect(url);

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set({
    name: EMULATE_USER_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
