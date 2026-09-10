'use client';

import { useState } from 'react';
import type { CategoryPublic, CreateCategoryInput } from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { categoriesApi } from '@/lib/api';
import { useCategories } from '@/hooks/useCategories';
import { PLACEHOLDER_AVATAR } from '@/lib/placeholders';
import { formatDate } from '@/lib/format';
import {
  AdminTd,
  AdminTh,
  EmptyRow,
  ErrorNote,
  LoadingRow,
  TableShell,
  btnDanger,
  btnGhost,
  btnPrimary,
  inputClasses,
} from '@/components/admin/admin-ui';

type NewCategory = {
  name: string;
  slug: string;
  description: string;
  thumbnail: string;
};

const empty: NewCategory = { name: '', slug: '', description: '', thumbnail: '' };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminCategoriesPage() {
  const { accessToken } = useAuth();
  const { categories, isLoading, error, refetch } = useCategories();
  const [form, setForm] = useState<NewCategory>(empty);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<CategoryPublic | null>(null);
  const [editForm, setEditForm] = useState<NewCategory>(empty);
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const input: CreateCategoryInput = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      ...(form.description ? { description: form.description } : {}),
      ...(form.thumbnail ? { thumbnail: form.thumbnail } : {}),
    };
    try {
      await categoriesApi.create(accessToken, input);
      setForm(empty);
      void refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(category: CategoryPublic) {
    setEditing(category);
    setEditForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      thumbnail: category.thumbnail ?? '',
    });
  }

  async function saveEdit() {
    if (!accessToken || !editing || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await categoriesApi.update(accessToken, editing.id, {
        ...(editForm.name !== editing.name ? { name: editForm.name } : {}),
        ...(editForm.slug !== editing.slug ? { slug: editForm.slug } : {}),
        ...(editForm.description !== (editing.description ?? '') ? { description: editForm.description || undefined } : {}),
        ...(editForm.thumbnail !== (editing.thumbnail ?? '') ? { thumbnail: editForm.thumbnail || undefined } : {}),
      });
      setEditing(null);
      void refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: CategoryPublic) {
    if (!accessToken) return;
    if (!window.confirm(`Delete category "${category.name}"? Channels and streams keep their freeform text.`)) return;
    setSubmitError(null);
    try {
      await categoriesApi.remove(accessToken, category.id);
      if (editing?.id === category.id) setEditing(null);
      void refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <ErrorNote error={error} onRetry={() => void refetch()} />
      <ErrorNote error={submitError} />

      <form onSubmit={create} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
        <h2 className="mb-3 text-label-md text-on-surface">New category</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            minLength={2}
            maxLength={50}
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({ ...f, name, slug: f.slug || slugify(name) }));
            }}
            placeholder="Name (e.g. Cooking)"
            aria-label="Category name"
            className={inputClasses}
          />
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="Slug (auto-generated)"
            aria-label="Category slug"
            className={inputClasses}
          />
          <input
            value={form.thumbnail}
            onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.value }))}
            placeholder="Thumbnail URL (optional)"
            aria-label="Category thumbnail URL"
            className={`${inputClasses} md:col-span-2`}
          />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Short description (optional)"
            aria-label="Category description"
            className={`${inputClasses} md:col-span-2`}
          />
        </div>
        <button type="submit" disabled={submitting} className={`${btnPrimary} mt-3`}>
          {submitting ? 'Creating…' : 'Create category'}
        </button>
      </form>

      <TableShell>
        <thead>
          <tr className="border-b border-outline-variant/30">
            <AdminTh>Category</AdminTh>
            <AdminTh>Slug</AdminTh>
            <AdminTh>Description</AdminTh>
            <AdminTh>Created</AdminTh>
            <AdminTh>Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && categories.length === 0 ? (
            <LoadingRow cols={5} />
          ) : categories.length === 0 ? (
            <EmptyRow cols={5} message="No categories yet — create the first one above." />
          ) : (
            categories.map((category) => (
              <tr key={category.id} className="border-b border-outline-variant/20 last:border-0">
                <AdminTd>
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={category.thumbnail ?? PLACEHOLDER_AVATAR}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-8 shrink-0 rounded object-cover"
                    />
                    {editing?.id === category.id ? (
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        aria-label={`Name for ${category.name}`}
                        className={`${inputClasses} max-w-[12rem] px-2 py-1`}
                      />
                    ) : (
                      <p className="truncate font-medium">{category.name}</p>
                    )}
                  </div>
                </AdminTd>
                <AdminTd>
                  {editing?.id === category.id ? (
                    <input
                      value={editForm.slug}
                      onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                      aria-label={`Slug for ${category.name}`}
                      className={`${inputClasses} max-w-[12rem] px-2 py-1`}
                    />
                  ) : (
                    <span className="text-on-surface-variant">/{category.slug}</span>
                  )}
                </AdminTd>
                <AdminTd className="max-w-[16rem]">
                  {editing?.id === category.id ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        value={editForm.thumbnail}
                        onChange={(e) => setEditForm((f) => ({ ...f, thumbnail: e.target.value }))}
                        placeholder="Thumbnail URL"
                        aria-label={`Thumbnail for ${category.name}`}
                        className={`${inputClasses} px-2 py-1`}
                      />
                      <input
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Description"
                        aria-label={`Description for ${category.name}`}
                        className={`${inputClasses} px-2 py-1`}
                      />
                    </div>
                  ) : (
                    <span className="block truncate text-on-surface-variant">{category.description ?? '—'}</span>
                  )}
                </AdminTd>
                <AdminTd className="whitespace-nowrap text-on-surface-variant">{formatDate(category.createdAt)}</AdminTd>
                <AdminTd>
                  <div className="flex items-center gap-1">
                    {editing?.id === category.id ? (
                      <>
                        <button
                          disabled={saving}
                          onClick={() => void saveEdit()}
                          className={`${btnGhost} px-2 py-1 text-primary`}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button disabled={saving} onClick={() => setEditing(null)} className={`${btnGhost} px-2 py-1`}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(category)} className={`${btnGhost} px-2 py-1 text-primary`}>
                        Edit
                      </button>
                    )}
                    <button onClick={() => void remove(category)} className={`${btnDanger} px-2 py-1`}>
                      Delete
                    </button>
                  </div>
                </AdminTd>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
    </div>
  );
}