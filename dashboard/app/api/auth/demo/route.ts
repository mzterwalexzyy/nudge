import { NextRequest, NextResponse } from 'next/server';
import { applicationRedirectUrl, assertSessionConfiguration, requestIsSameOrigin, setSession } from '@/lib/auth';
import { createDemoProfile } from '@/lib/users';

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    assertSessionConfiguration();
    const user = createDemoProfile();
    setSession({ sub: user.id, name: user.display_name, email: null, type: 'demo' });
    return NextResponse.redirect(applicationRedirectUrl(request, '/overview'), 303);
  } catch {
    return NextResponse.json({ error: 'Demo profile could not be created.' }, { status: 500 });
  }
}
