import { NextRequest, NextResponse } from 'next/server';
import { clearSession, requestIsSameOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  clearSession();
  return NextResponse.redirect(new URL('/', request.url), 303);
}
