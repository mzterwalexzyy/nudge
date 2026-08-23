import { NextRequest, NextResponse } from 'next/server';
import * as pipeline from '@second-brain/pipeline';
import { requestIsSameOrigin } from '@/lib/auth';
import { currentUser } from '@/lib/users';

function summary(item: any) {
  return { id: item.id, title: item.title, kind: item.kind };
}

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to save links.' }, { status: 401 });
  try {
    const body = await request.json();
    const rawUrl = typeof body.url === 'string' ? body.url.trim().slice(0, 2048) : '';
    let url: URL;
    try {
      url = new URL(rawUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      return NextResponse.json({ error: 'Enter a valid public HTTP(S) URL.' }, { status: 400 });
    }

    pipeline.initSchema();
    pipeline.migrateSchema();
    pipeline.migrateColumns();
    const canonical = url.toString();
    const duplicate = pipeline.getItemByCaptureKey(canonical, 'save_button', user.id);
    if (duplicate) return NextResponse.json({ ok: true, deduplicated: true, parent: summary(duplicate) });

    const fetched = await pipeline.safeIngest(canonical);
    if (!fetched.ok || fetched.raw_text.length < 100) {
      return NextResponse.json({ error: `This page could not be read safely: ${fetched.error || 'not enough readable text'}` }, { status: 422 });
    }
    const existing = pipeline.getItemsWithEmbeddings(user.id);
    const { parent, children } = await pipeline.processItemTree(canonical, {
      source: 'save_button',
      existing,
      checkLive: false,
      fetchLinks: true,
      preText: { title: fetched.title, raw_text: fetched.raw_text, links: fetched.links || [] },
    });
    parent.user_id = user.id;
    parent.linked_fetch_status = 'page_fetched';
    const savedParent = pipeline.insertItem(parent);
    const savedChildren = children.map((child: any) => {
      child.user_id = user.id;
      child.parent_id = savedParent.id;
      child.linked_fetch_status = 'page_fetched';
      return pipeline.insertItem(child);
    });
    return NextResponse.json({ ok: true, deduplicated: false, parent: summary(savedParent), children: savedChildren.map(summary) });
  } catch {
    return NextResponse.json({ error: 'The link could not be saved.' }, { status: 500 });
  }
}
