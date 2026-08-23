import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { requestIsSameOrigin, setSession } from '@/lib/auth';
import { getUserByEmail } from '@/lib/users';
import { clearLoginFailures, loginBlocked, recordLoginFailure } from '@/lib/login-rate-limit';

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const key = `${forwarded}:${email}`;
    if (loginBlocked(key)) return NextResponse.json({ error: 'Too many attempts. Try again in one minute.' }, { status: 429 });
    const user = getUserByEmail(email);
    const valid = !!user?.password_hash && await compare(password, user.password_hash);
    if (!user || !valid) {
      recordLoginFailure(key);
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    clearLoginFailures(key);
    setSession({ sub: user.id, name: user.display_name, email: user.email, type: 'user' });
    return NextResponse.json({ ok: true, redirect: '/overview' });
  } catch {
    return NextResponse.json({ error: 'Could not sign in.' }, { status: 500 });
  }
}
