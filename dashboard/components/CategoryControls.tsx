'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export type CategoryOption = {
  key: string;
  name: string;
};

async function categoryRequest(body: Record<string, unknown>) {
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'Category update failed.');
  return result;
}

export function CategoryRename({ categoryKey, currentName }: { categoryKey: string; currentName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await categoryRequest({ action: 'rename', categoryKey, name });
      setEditing(false);
      router.refresh();
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button type="button" className="category-edit-button" onClick={() => setEditing(true)}>
        Rename category
      </button>
    );
  }

  return (
    <form className="category-rename-form" onSubmit={submit}>
      <label htmlFor="category-name">Category name</label>
      <input
        id="category-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        autoFocus
        required
      />
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      <button className="btn btn-secondary" type="button" onClick={() => { setEditing(false); setName(currentName); setError(''); }} disabled={busy}>
        Cancel
      </button>
      {error && <span className="category-control-error" role="alert">{error}</span>}
    </form>
  );
}

export function ItemCategoryMove({
  itemId,
  currentCategoryKey,
  categories,
  compact = false,
}: {
  itemId: string;
  currentCategoryKey: string;
  categories: CategoryOption[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(currentCategoryKey);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await categoryRequest({
        action: 'move',
        itemId,
        targetCategoryKey: target === '__new__' ? '' : target,
        newCategoryName: target === '__new__' ? newName : '',
      });
      setOpen(false);
      if (compact) router.push(`/organized/${encodeURIComponent(result.category_key)}`);
      else router.refresh();
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={compact ? 'category-move-button compact' : 'category-move-button'}
        onClick={() => setOpen(true)}
      >
        Move
      </button>
    );
  }

  return (
    <form className={compact ? 'category-move-form compact' : 'category-move-form'} onSubmit={submit}>
      <label htmlFor={`move-${itemId}`}>Move to</label>
      <select id={`move-${itemId}`} value={target} onChange={(event) => setTarget(event.target.value)}>
        {categories.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}
        <option value="__new__">+ New category</option>
      </select>
      {target === '__new__' && (
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New category name"
          maxLength={60}
          required
          autoFocus
        />
      )}
      <div className="category-move-actions">
        <button className="btn" type="submit" disabled={busy || (target === currentCategoryKey && !newName)}>
          {busy ? 'Moving…' : 'Move item'}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => { setOpen(false); setTarget(currentCategoryKey); setNewName(''); setError(''); }} disabled={busy}>
          Cancel
        </button>
      </div>
      {error && <span className="category-control-error" role="alert">{error}</span>}
    </form>
  );
}
