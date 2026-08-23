import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'nudge_session';
export const SESSION_TTL_SECONDS = 15 * 60;

export type SessionClaims = {
  sub: string;
  name: string;
  email: string | null;
  type: 'user' | 'demo' | 'development';
  iat: number;
  exp: number;
};

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET || '';
  if (configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
  }
  return 'nudge-development-session-secret-not-for-production';
}

export function assertSessionConfiguration() {
  sessionSecret();
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(input: string): string {
  return createHmac('sha256', sessionSecret()).update(input).digest('base64url');
}

export function issueSessionToken(user: Pick<SessionClaims, 'sub' | 'name' | 'email' | 'type'>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ ...user, iat: now, exp: now + SESSION_TTL_SECONDS });
  const input = `${header}.${payload}`;
  return `${input}.${signature(input)}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const [header, payload, suppliedSignature, extra] = token.split('.');
    if (!header || !payload || !suppliedSignature || extra) return null;
    const input = `${header}.${payload}`;
    const expected = Buffer.from(signature(input));
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const headerValue = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
    if (headerValue.alg !== 'HS256' || headerValue.typ !== 'JWT') return null;
    if (!claims.sub || !claims.name || !['user', 'demo', 'development'].includes(claims.type)) return null;
    if (!Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function currentSession(): SessionClaims | null {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    return token ? verifySessionToken(token) : null;
  } catch {
    return null;
  }
}

export function setSession(user: Pick<SessionClaims, 'sub' | 'name' | 'email' | 'type'>) {
  cookies().set(SESSION_COOKIE, issueSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSession() {
  cookies().set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export type ApplicationRedirectPath = '/' | '/overview';

export function applicationOrigin(request: Request): string {
  const configured = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_URL or RENDER_EXTERNAL_URL must be configured in production.');
    }
    return new URL(request.url).origin;
  }

  const parsed = new URL(configured);
  const loopbackHttp = parsed.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase());
  if (
    (parsed.protocol !== 'https:' && !loopbackHttp)
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('The application URL must be an HTTPS origin without credentials, path, query, or hash.');
  }
  return parsed.origin;
}

export function applicationRedirectUrl(request: Request, path: ApplicationRedirectPath): URL {
  return new URL(path, applicationOrigin(request));
}

export function requestIsSameOrigin(request: Request): boolean {
  const source = request.headers.get('origin') || request.headers.get('referer');
  if (!source) return process.env.NODE_ENV !== 'production';
  try {
    return new URL(source).origin === applicationOrigin(request);
  } catch {
    return false;
  }
}
