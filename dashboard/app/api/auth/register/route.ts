import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { assertSessionConfiguration, requestIsSameOrigin, setSession } from '@/lib/auth';
import { createRegisteredUser, getUserByEmail } from '@/lib/users';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.replace(/\s+/g, ' ').trim().slice(0, 50) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!EMAIL.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    if (displayName.length < 2) return NextResponse.json({ error: 'Enter your name.' }, { status: 400 });
    if (password.length < 10 || password.length > 128) return NextResponse.json({ error: 'Password must be 10–128 characters.' }, { status: 400 });
    if (getUserByEmail(email)) return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
    assertSessionConfiguration();
    const user = createRegisteredUser({ email, displayName, passwordHash: await hash(password, 12) });
    setSession({ sub: user.id, name: user.display_name, email: user.email, type: 'user' });
    return NextResponse.json({ ok: true, redirect: '/overview' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 });
  }
}
