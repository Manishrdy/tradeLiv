'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api, Room, RoomPayload } from '@/lib/api';

/* ── Constants ──────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  'Sofa', 'Dining Table', 'Bed', 'Desk', 'Storage',
  'Lighting', 'Fan', 'Rug', 'Wardrobe', 'TV Unit',
  'Armchair', 'Side Table', 'Bookshelf', 'Mirror', 'Curtains',
];

const STYLE_OPTIONS = [
  'Modern', 'Contemporary', 'Traditional', 'Minimalist',
  'Industrial', 'Bohemian', 'Scandinavian', 'Classic',
];

/* ── Types ──────────────────────────────────────────────── */

interface RoomFormState {
  name: string;
  lengthFt: string;
  widthFt: string;
  heightFt: string;
  budgetMin: string;
  budgetMax: string;
  categoryNeeds: string[];
  notes: string;
  colorPalette: string;
  materialPreferences: string;
  seatingCapacity: string;
  functionalConstraints: string;
  inspirationLinks: string[];
}

const emptyForm = (): RoomFormState => ({
  name: '',
  lengthFt: '',
  widthFt: '',
  heightFt: '',
  budgetMin: '',
  budgetMax: '',
  categoryNeeds: [],
  notes: '',
  colorPalette: '',
  materialPreferences: '',
  seatingCapacity: '',
  functionalConstraints: '',
  inspirationLinks: [''],
});

function roomToForm(r: Room): RoomFormState {
  return {
    name: r.name,
    lengthFt: r.lengthFt != null ? String(r.lengthFt) : '',
    widthFt: r.widthFt != null ? String(r.widthFt) : '',
    heightFt: r.heightFt != null ? String(r.heightFt) : '',
    budgetMin: r.budgetMin != null ? String(r.budgetMin) : '',
    budgetMax: r.budgetMax != null ? String(r.budgetMax) : '',
    categoryNeeds: r.categoryNeeds ?? [],
    notes: r.notes ?? '',
    colorPalette: r.clientRequirements?.colorPalette ?? '',
    materialPreferences: r.clientRequirements?.materialPreferences ?? '',
    seatingCapacity: r.clientRequirements?.seatingCapacity != null ? String(r.clientRequirements.seatingCapacity) : '',
    functionalConstraints: r.clientRequirements?.functionalConstraints ?? '',
    inspirationLinks: r.clientRequirements?.inspirationLinks?.length ? r.clientRequirements.inspirationLinks : [''],
  };
}

function formToPayload(f: RoomFormState): RoomPayload {
  const links = f.inspirationLinks.map((l) => l.trim()).filter(Boolean);
  const hasClientReqs =
    f.colorPalette.trim() || f.materialPreferences.trim() ||
    f.seatingCapacity.trim() || f.functionalConstraints.trim() || links.length;

  return {
    name: f.name.trim(),
    lengthFt: f.lengthFt ? Number(f.lengthFt) : undefined,
    widthFt: f.widthFt ? Number(f.widthFt) : undefined,
    heightFt: f.heightFt ? Number(f.heightFt) : undefined,
    budgetMin: f.budgetMin ? Number(f.budgetMin) : undefined,
    budgetMax: f.budgetMax ? Number(f.budgetMax) : undefined,
    categoryNeeds: f.categoryNeeds,
    notes: f.notes.trim() || undefined,
    clientRequirements: hasClientReqs ? {
      colorPalette: f.colorPalette.trim() || undefined,
      materialPreferences: f.materialPreferences.trim() || undefined,
      seatingCapacity: f.seatingCapacity ? Number(f.seatingCapacity) : undefined,
      functionalConstraints: f.functionalConstraints.trim() || undefined,
      inspirationLinks: links.length ? links : undefined,
    } : undefined,
  };
}

function formatBudget(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1).replace('.0', '')}Cr`;
    if (v >= 100000)   return `₹${(v / 100000).toFixed(1).replace('.0', '')}L`;
    return `₹${(v / 1000).toFixed(0)}K`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

/* ── Sub-components ─────────────────────────────────────── */

function CategoryChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${selected ? 'var(--gold-border)' : 'var(--border)'}`,
        background: selected ? 'var(--gold-dim)' : 'transparent',
        color: selected ? 'var(--gold)' : 'var(--text-muted)',
        borderRadius: 999, padding: '4px 12px',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function InspirationLinks({
  links,
  onChange,
}: {
  links: string[];
  onChange: (links: string[]) => void;
}) {
  const update = (i: number, val: string) => {
    const next = [...links];
    next[i] = val;
    onChange(next);
  };
  const add = () => onChange([...links, '']);
  const remove = (i: number) => {
    const next = links.filter((_, idx) => idx !== i);
    onChange(next.length ? next : ['']);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {links.map((link, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input
            className="input-field"
            type="url"
            placeholder="https://www.pinterest.com/…"
            value={link}
            onChange={(e) => update(i, e.target.value)}
            style={{ flex: 1, fontSize: 13 }}
          />
          {links.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              style={{
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'transparent', color: 'var(--text-muted)',
                padding: '0 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: 'flex-start', border: '1px dashed var(--border-strong)',
          borderRadius: 8, background: 'transparent',
          color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
          padding: '5px 12px', cursor: 'pointer',
        }}
      >
        + Add link
      </button>
    </div>
  );
}

/* ── Room Form ──────────────────────────────────────────── */

function RoomForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: RoomFormState;
  onSave: (f: RoomFormState) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<RoomFormState>(initial);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (k: keyof RoomFormState, v: unknown) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const toggleCategory = (cat: string) => {
    set(
      'categoryNeeds',
      form.categoryNeeds.includes(cat)
        ? form.categoryNeeds.filter((c) => c !== cat)
        : [...form.categoryNeeds, cat],
    );
  };

  const areaSqft =
    form.lengthFt && form.widthFt
      ? (Number(form.lengthFt) * Number(form.widthFt)).toFixed(1)
      : null;

  const fieldLabel = (label: string, optional = true) => (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
      {label}{optional && <span style={{ fontWeight: 400, fontSize: 10.5 }}> (optional)</span>}
    </div>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Name */}
      <div>
        {fieldLabel('Room Name', false)}
        <input
          ref={nameRef}
          className="input-field"
          placeholder="e.g. Master Bedroom"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </div>

      {/* Dimensions */}
      <div>
        {fieldLabel('Dimensions (ft)')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(['lengthFt', 'widthFt', 'heightFt'] as const).map((k, i) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                {['Length', 'Width', 'Height'][i]}
              </div>
              <input
                className="input-field"
                type="number"
                min="0"
                step="0.1"
                placeholder="–"
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>
        {areaSqft && (
          <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, marginTop: 6 }}>
            Area: {areaSqft} sq ft
          </div>
        )}
      </div>

      {/* Budget */}
      <div>
        {fieldLabel('Room Budget')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['budgetMin', 'budgetMax'] as const).map((k, i) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                {['Min (₹)', 'Max (₹)'][i]}
              </div>
              <input
                className="input-field"
                type="number"
                min="0"
                step="1000"
                placeholder="–"
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Category needs */}
      <div>
        {fieldLabel('Furniture Needed')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORY_OPTIONS.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              selected={form.categoryNeeds.includes(cat)}
              onClick={() => toggleCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Designer notes */}
      <div>
        {fieldLabel('Designer Notes')}
        <textarea
          className="input-field"
          placeholder="Internal notes for your reference…"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {/* Client Requirements */}
      <div style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Client Requirements
        </div>

        <div>
          {fieldLabel('Colour Palette')}
          <input
            className="input-field"
            placeholder="e.g. Warm neutrals, earthy tones…"
            value={form.colorPalette}
            onChange={(e) => set('colorPalette', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          {fieldLabel('Material Preferences')}
          <input
            className="input-field"
            placeholder="e.g. Solid wood, no MDF…"
            value={form.materialPreferences}
            onChange={(e) => set('materialPreferences', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          <div>
            {fieldLabel('Seating Capacity')}
            <input
              className="input-field"
              type="number"
              min="0"
              placeholder="–"
              value={form.seatingCapacity}
              onChange={(e) => set('seatingCapacity', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            {fieldLabel('Functional Constraints')}
            <input
              className="input-field"
              placeholder="e.g. Wheelchair accessible…"
              value={form.functionalConstraints}
              onChange={(e) => set('functionalConstraints', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div>
          {fieldLabel('Inspiration Links')}
          <InspirationLinks
            links={form.inspirationLinks}
            onChange={(links) => set('inspirationLinks', links)}
          />
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(180,30,30,0.07)', border: '1px solid rgba(180,30,30,0.18)',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b41e1e',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || !form.name.trim()}
          style={{ minWidth: 90 }}
        >
          {saving ? 'Saving…' : 'Save Room'}
        </button>
      </div>
    </form>
  );
}

/* ── Room Card ──────────────────────────────────────────── */

function RoomCard({
  room,
  projectId,
  onUpdated,
  onDeleted,
}: {
  room: Room;
  projectId: string;
  onUpdated: (r: Room) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const budget = formatBudget(room.budgetMin, room.budgetMax);

  const handleSave = async (f: RoomFormState) => {
    setSaving(true);
    setFormError(null);
    const result = await api.updateRoom(projectId, room.id, formToPayload(f));
    setSaving(false);
    if (result.error) { setFormError(result.error); return; }
    onUpdated(result.data!);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await api.deleteRoom(projectId, room.id);
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      setConfirmDelete(false);
      return;
    }
    onDeleted(room.id);
  };

  if (editing) {
    return (
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18 }}>
          Edit: {room.name}
        </div>
        <RoomForm
          initial={roomToForm(room)}
          onSave={handleSave}
          onCancel={() => { setEditing(false); setFormError(null); }}
          saving={saving}
          error={formError}
        />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>
            {room.name}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>
            {room.areaSqft != null && (
              <span>{room.areaSqft} sq ft</span>
            )}
            {room.lengthFt != null && room.widthFt != null && (
              <span style={{ color: 'var(--border-strong)' }}>
                {room.lengthFt} × {room.widthFt}{room.heightFt != null ? ` × ${room.heightFt}` : ''} ft
              </span>
            )}
            {budget && (
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{budget}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'transparent', color: 'var(--text-muted)',
              padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              border: '1px solid rgba(180,30,30,0.2)', borderRadius: 8,
              background: 'transparent', color: '#b41e1e',
              padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Category chips */}
      {room.categoryNeeds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {room.categoryNeeds.map((cat) => (
            <span
              key={cat}
              style={{
                border: '1px solid var(--border)', borderRadius: 999,
                padding: '2px 10px', fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600,
              }}
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Client requirements summary */}
      {room.clientRequirements && (
        <div style={{
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 12px',
          fontSize: 12.5, color: 'var(--text-secondary)',
          display: 'flex', flexDirection: 'column', gap: 4,
          marginBottom: 10,
        }}>
          {room.clientRequirements.colorPalette && (
            <div><span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Palette: </span>{room.clientRequirements.colorPalette}</div>
          )}
          {room.clientRequirements.materialPreferences && (
            <div><span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Materials: </span>{room.clientRequirements.materialPreferences}</div>
          )}
          {room.clientRequirements.seatingCapacity != null && (
            <div><span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Seating: </span>{room.clientRequirements.seatingCapacity} persons</div>
          )}
          {room.clientRequirements.functionalConstraints && (
            <div><span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Constraints: </span>{room.clientRequirements.functionalConstraints}</div>
          )}
          {room.clientRequirements.inspirationLinks?.length ? (
            <div>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Inspiration: </span>
              {room.clientRequirements.inspirationLinks.map((link, i) => (
                <a key={i} href={link} target="_blank" rel="noreferrer"
                  style={{ color: 'var(--gold)', marginRight: 8, fontSize: 12 }}>
                  Link {i + 1}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Notes */}
      {room.notes && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {room.notes}
        </div>
      )}

      {/* Delete error */}
      {deleteError && (
        <div style={{
          marginTop: 10,
          background: 'rgba(180,30,30,0.07)', border: '1px solid rgba(180,30,30,0.18)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#b41e1e',
        }}>
          {deleteError}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{
          marginTop: 12, padding: '12px 14px',
          background: 'rgba(180,30,30,0.05)', border: '1px solid rgba(180,30,30,0.15)',
          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 12.5, color: '#b41e1e', fontWeight: 600 }}>
            Delete this room? This cannot be undone.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'transparent', color: 'var(--text-muted)',
                padding: '4px 12px', fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                border: 'none', borderRadius: 6,
                background: '#b41e1e', color: '#fff',
                padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

export default function RoomsPage() {
  const { id } = useParams<{ id: string }>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    api.getProject(id).then((r) => {
      if (r.data) setRooms(r.data.rooms);
      setLoading(false);
    });
  }, [id]);

  const handleCreate = async (f: RoomFormState) => {
    setSavingNew(true);
    setAddError(null);
    const result = await api.createRoom(id, formToPayload(f));
    setSavingNew(false);
    if (result.error) { setAddError(result.error); return; }
    setRooms((prev) => [...prev, result.data!]);
    setAdding(false);
  };

  const handleUpdated = (updated: Room) =>
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const handleDeleted = (roomId: string) =>
    setRooms((prev) => prev.filter((r) => r.id !== roomId));

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 3 }}>
            Rooms
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            {rooms.length} {rooms.length === 1 ? 'Room' : 'Rooms'}
          </h2>
        </div>
        {!adding && (
          <button
            className="btn-primary"
            onClick={() => { setAdding(true); setAddError(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Room
          </button>
        )}
      </div>

      {/* Add room form */}
      {adding && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18 }}>
            New Room
          </div>
          <RoomForm
            initial={emptyForm()}
            onSave={handleCreate}
            onCancel={() => { setAdding(false); setAddError(null); }}
            saving={savingNew}
            error={addError}
          />
        </div>
      )}

      {/* Room list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
          <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading rooms…
        </div>
      ) : rooms.length === 0 && !adding ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
            background: 'var(--bg-input)', border: '1.5px dashed var(--border-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            No rooms yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
            Add rooms to start planning furniture for each space.
          </div>
          <button
            className="btn-primary"
            onClick={() => { setAdding(true); setAddError(null); }}
          >
            Add First Room
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              projectId={id}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
