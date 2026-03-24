'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, FurnitureCategory, FurnitureCategoryPayload } from '@/lib/api';

/* ── Group colors ──────────────────────────────────────── */

const GROUP_COLORS: Record<string, { bg: string; text: string }> = {
  Seating:  { bg: '#EDF5FF', text: '#2B6CB0' },
  Tables:   { bg: '#FFF8E1', text: '#9E7C3F' },
  Bedroom:  { bg: '#F3E8FF', text: '#6B46C1' },
  Storage:  { bg: '#E8F5E9', text: '#2E7D32' },
  Decor:    { bg: '#FFF3E0', text: '#E65100' },
};

function groupBadge(group: string | null) {
  if (!group) return null;
  const colors = GROUP_COLORS[group] ?? { bg: 'var(--bg-input)', text: 'var(--text-muted)' };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
      color: colors.text, background: colors.bg,
      padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
    }}>
      {group}
    </span>
  );
}

/* ── Empty form ────────────────────────────────────────── */

const emptyForm = (): FurnitureCategoryPayload => ({
  name: '',
  group: '',
  icon: '',
  sortOrder: 0,
  active: true,
});

function catToForm(c: FurnitureCategory): FurnitureCategoryPayload {
  return {
    name: c.name,
    group: c.group ?? '',
    icon: c.icon ?? '',
    sortOrder: c.sortOrder,
    active: c.active,
  };
}

/* ── Category Form Modal ───────────────────────────────── */

function CategoryFormModal({
  initial,
  title,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: FurnitureCategoryPayload;
  title: string;
  onSave: (f: FurnitureCategoryPayload) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState(initial);

  const set = (k: keyof FurnitureCategoryPayload, v: unknown) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="card" style={{ width: 440, padding: '28px 30px' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 20px' }}>
          {title}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Name *
            </label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Coffee Table"
              style={{ fontSize: 13, width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Group
              </label>
              <input
                className="input-field"
                value={form.group ?? ''}
                onChange={(e) => set('group', e.target.value)}
                placeholder="e.g. Seating"
                style={{ fontSize: 13, width: '100%' }}
                list="group-suggestions"
              />
              <datalist id="group-suggestions">
                {['Seating', 'Tables', 'Bedroom', 'Storage', 'Decor'].map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Icon
              </label>
              <input
                className="input-field"
                value={form.icon ?? ''}
                onChange={(e) => set('icon', e.target.value)}
                placeholder="e.g. 🛋️"
                style={{ fontSize: 13, width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Sort Order
              </label>
              <input
                className="input-field"
                type="number"
                min="0"
                value={form.sortOrder ?? 0}
                onChange={(e) => set('sortOrder', Number(e.target.value))}
                style={{ fontSize: 13, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Status
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40 }}>
                <button
                  type="button"
                  onClick={() => set('active', !form.active)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                    background: form.active ? '#2E7D32' : '#ccc',
                    position: 'relative', transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: form.active ? 20 : 2,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <span style={{ fontSize: 13, color: form.active ? '#2E7D32' : 'var(--text-muted)', fontWeight: 600 }}>
                  {form.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(180,30,30,0.07)', border: '1px solid rgba(180,30,30,0.18)',
            borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b41e1e', marginTop: 14,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 13, fontWeight: 600, padding: '9px 18px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            style={{ fontSize: 13, padding: '9px 18px', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */

export default function AdminFurnitureCategoriesPage() {
  const [categories, setCategories] = useState<FurnitureCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingCat, setEditingCat] = useState<FurnitureCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('all');

  const load = useCallback(() => {
    setLoading(true);
    api.getAdminFurnitureCategories().then((r) => {
      if (r.data) setCategories(r.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = Array.from(new Set(categories.map((c) => c.group).filter(Boolean))) as string[];
  const filtered = filterGroup === 'all' ? categories : categories.filter((c) => c.group === filterGroup);

  async function handleCreate(form: FurnitureCategoryPayload) {
    setSaving(true);
    setFormError(null);
    const r = await api.createFurnitureCategory(form);
    setSaving(false);
    if (r.error) { setFormError(r.error); return; }
    setShowAdd(false);
    load();
  }

  async function handleUpdate(form: FurnitureCategoryPayload) {
    if (!editingCat) return;
    setSaving(true);
    setFormError(null);
    const r = await api.updateFurnitureCategory(editingCat.id, form);
    setSaving(false);
    if (r.error) { setFormError(r.error); return; }
    setEditingCat(null);
    load();
  }

  async function handleDelete(cat: FurnitureCategory) {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone. Existing rooms that reference this category will keep their data.`)) return;
    const r = await api.deleteFurnitureCategory(cat.id);
    if (r.error) { alert(r.error); return; }
    load();
  }

  async function handleToggleActive(cat: FurnitureCategory) {
    const r = await api.updateFurnitureCategory(cat.id, {
      name: cat.name,
      group: cat.group,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      active: !cat.active,
    });
    if (r.error) { alert(r.error); return; }
    load();
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 40px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
        <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Furniture Categories
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Manage the furniture options that designers see when creating rooms. {categories.length} total.
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ fontSize: 13, padding: '9px 18px' }}
          onClick={() => { setShowAdd(true); setFormError(null); }}
        >
          + Add Category
        </button>
      </div>

      {/* Group filter tabs */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterGroup('all')}
            style={{
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
              border: '1px solid var(--border)', cursor: 'pointer',
              background: filterGroup === 'all' ? 'var(--text-primary)' : 'transparent',
              color: filterGroup === 'all' ? '#fff' : 'var(--text-muted)',
            }}
          >
            All ({categories.length})
          </button>
          {groups.map((g) => {
            const count = categories.filter((c) => c.group === g).length;
            return (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', cursor: 'pointer',
                  background: filterGroup === g ? 'var(--text-primary)' : 'transparent',
                  color: filterGroup === g ? '#fff' : 'var(--text-muted)',
                }}
              >
                {g} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['', 'Name', 'Group', 'Sort', 'Status', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  width: h === '' && i === 0 ? 40 : h === '' ? 120 : undefined,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((cat) => (
              <tr
                key={cat.id}
                style={{
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                  opacity: cat.active ? 1 : 0.5,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-input)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
              >
                <td style={{ padding: '12px 16px', fontSize: 18, textAlign: 'center' }}>
                  {cat.icon || ''}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {cat.name}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {groupBadge(cat.group)}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {cat.sortOrder}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleToggleActive(cat)}
                    title={cat.active ? 'Click to deactivate' : 'Click to activate'}
                    style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                      color: cat.active ? '#2E7D32' : '#8b2635',
                      background: cat.active ? '#e8f5e9' : '#fdecea',
                      padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    {cat.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setEditingCat(cat); setFormError(null); }}
                      style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                        background: 'none', border: '1px solid var(--border)',
                        padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#8b2635',
                        background: 'none', border: '1px solid #fdecea',
                        padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
            No categories found.
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <CategoryFormModal
          initial={emptyForm()}
          title="Add Category"
          onSave={handleCreate}
          onCancel={() => setShowAdd(false)}
          saving={saving}
          error={formError}
        />
      )}

      {/* Edit modal */}
      {editingCat && (
        <CategoryFormModal
          initial={catToForm(editingCat)}
          title={`Edit: ${editingCat.name}`}
          onSave={handleUpdate}
          onCancel={() => setEditingCat(null)}
          saving={saving}
          error={formError}
        />
      )}
    </div>
  );
}
