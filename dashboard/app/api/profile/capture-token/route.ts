import { NextRequest, NextResponse } from 'next/server';
import { requestIsSameOrigin } from '@/lib/auth';
import { createCaptureCredential, currentUser } from '@/lib/users';

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (user.account_type === 'demo') return NextResponse.json({ error: 'Extension pairing is unavailable for temporary demo profiles.' }, { status: 403 });
  return NextResponse.json({ ok: true, token: createCaptureCredential(user.id) });
}
