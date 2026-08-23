import { NextRequest, NextResponse } from 'next/server';
import { applicationRedirectUrl, clearSession, requestIsSameOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  clearSession();
  return NextResponse.redirect(applicationRedirectUrl(request, '/'), 303);
}
