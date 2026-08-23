import { NextRequest, NextResponse } from 'next/server';
import { applyCleanup, sanitizeBuckets } from '@/lib/db';
import { requestIsSameOrigin } from '@/lib/auth';
import { currentUser } from '@/lib/users';

const ACTIONS = {
  expired: 'expire',
  unattended: 'stale',
  duplicates: 'delete',
  dead: 'delete',
  stale: 'stale',
} as const;

type Bucket = keyof typeof ACTIONS;

/**
 * Applies one server-recomputed cleanup bucket only after explicit confirmation.
 * The client cannot choose an arbitrary destructive action or mutate ids that
 * are no longer members of the confirmed bucket.
 */
export async function POST(req: NextRequest) {
  if (!requestIsSameOrigin(req)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!currentUser()) return NextResponse.json({ error: 'Sign in to clean up items.' }, { status: 401 });
  try {
    const body = await req.json();
    const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
    const ids: string[] = [...new Set(
      rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
    )].slice(0, 500);
    const bucket = body?.bucket as Bucket;

    if (body?.confirmed !== true) {
      return NextResponse.json({ error: 'explicit confirmation is required' }, { status: 409 });
    }
    if (!ids.length) return NextResponse.json({ error: 'no ids provided' }, { status: 400 });
    if (!(bucket in ACTIONS)) return NextResponse.json({ error: 'invalid cleanup bucket' }, { status: 400 });

    const current = sanitizeBuckets()[bucket];
    const eligible = new Set(current.map((item) => item.id));
    if (ids.some((id) => !eligible.has(id))) {
      return NextResponse.json(
        { error: 'one or more items no longer belong to this cleanup bucket; refresh and review again' },
        { status: 409 },
      );
    }

    const result = applyCleanup(ids, ACTIONS[bucket]);
    return NextResponse.json({ ok: true, bucket, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'cleanup failed' }, { status: 500 });
  }
}
