import { NextRequest, NextResponse } from 'next/server';
import { moveItemToCategory, renameCategory } from '@/lib/db';
import { requestIsSameOrigin } from '@/lib/auth';
import { currentUser } from '@/lib/users';

const CATEGORY_KEY = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const ITEM_ID = /^[a-z0-9-]{1,80}$/i;

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
}

export async function POST(req: NextRequest) {
  if (!requestIsSameOrigin(req)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!currentUser()) return NextResponse.json({ error: 'Sign in to manage categories.' }, { status: 401 });
  try {
    const body = await req.json();
    if (body?.action === 'rename') {
      const categoryKey = typeof body.categoryKey === 'string' ? body.categoryKey.trim() : '';
      const name = cleanName(body.name);
      if (!CATEGORY_KEY.test(categoryKey)) {
        return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
      }
      if (!name) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
      return NextResponse.json({ ok: true, category: renameCategory(categoryKey, name) });
    }

    if (body?.action === 'move') {
      const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
      const targetCategoryKey = typeof body.targetCategoryKey === 'string'
        ? body.targetCategoryKey.trim()
        : '';
      const newCategoryName = cleanName(body.newCategoryName);
      if (!ITEM_ID.test(itemId)) return NextResponse.json({ error: 'Invalid item.' }, { status: 400 });
      if (!newCategoryName && !CATEGORY_KEY.test(targetCategoryKey)) {
        return NextResponse.json({ error: 'Choose a category or enter a new name.' }, { status: 400 });
      }
      const result = moveItemToCategory(itemId, { targetCategoryKey, newCategoryName });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Invalid category action.' }, { status: 400 });
  } catch (error: any) {
    const message = error?.message || 'Category update failed.';
    const status = /UNIQUE constraint/i.test(message) ? 409 : /no longer exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: status === 409 && /UNIQUE/i.test(message) ? 'That category name is already in use.' : message }, { status });
  }
}
