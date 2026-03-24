'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, Room, RoomPayload, FurnitureCategory } from '@/lib/api';

/* ── Constants ──────────────────────────────────────────── */

// Fallback if API hasn't loaded yet
const FALLBACK_CATEGORIES = [
  'Sofa', 'Dining Table', 'Bed', 'Desk', 'Storage',
  'Lighting', 'Fan', 'Rug', 'Wardrobe', 'TV Unit',
  'Armchair', 'Side Table', 'Bookshelf', 'Mirror', 'Curtains',
];

// Room-type auto-suggest: when room name contains a keyword, suggest these categories
const ROOM_TYPE_SUGGESTIONS: Record<string, string[]> = {
  'bedroom':     ['Bed', 'Wardrobe', 'Side Table', 'Lighting', 'Mirror', 'Rug', 'Curtains'],
  'master':      ['Bed', 'Wardrobe', 'Side Table', 'Lighting', 'Mirror', 'Rug', 'Curtains', 'Armchair'],
  'living':      ['Sofa', 'TV Unit', 'Side Table', 'Rug', 'Lighting', 'Curtains', 'Bookshelf'],
  'drawing':     ['Sofa', 'Armchair', 'Side Table', 'Rug', 'Lighting', 'Curtains', 'Mirror'],
  'dining':      ['Dining Table', 'Lighting', 'Storage', 'Mirror', 'Rug'],
  'kitchen':     ['Storage', 'Lighting'],
  'study':       ['Desk', 'Bookshelf', 'Lighting', 'Storage'],
  'office':      ['Desk', 'Bookshelf', 'Lighting', 'Storage'],
  'guest':       ['Bed', 'Wardrobe', 'Side Table', 'Lighting', 'Mirror'],
  'nursery':     ['Bed', 'Storage', 'Rug', 'Lighting', 'Curtains'],
  'kids':        ['Bed', 'Desk', 'Storage', 'Bookshelf', 'Rug', 'Lighting'],
  'balcony':     ['Armchair', 'Side Table', 'Lighting'],
  'patio':       ['Armchair', 'Side Table', 'Lighting'],
  'foyer':       ['Mirror', 'Lighting', 'Storage', 'Rug'],
  'library':     ['Bookshelf', 'Armchair', 'Desk', 'Lighting', 'Rug'],
  'pooja':       ['Storage', 'Lighting'],
};

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
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1).replace('.0', '')}M`;
    if (v >= 1000)    return `$${(v / 1000).toFixed(0)}K`;
    return `$${v}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

/* ── Room accent colors ────────────────────────────────── */

const ROOM_COLORS = [
  '#9E7C3F', '#2C6347', '#4A6FA5', '#8B6F47',
  '#6B5B73', '#5A7D7C', '#946B54', '#5C6B73',
];

function roomAccentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ROOM_COLORS[Math.abs(hash) % ROOM_COLORS.length];
}

/* ── Sub-components ─────────────────────────────────────── */

function CategoryChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${selected ? '#111111' : 'var(--border)'}`,
        background: selected ? '#111111' : 'transparent',
        color: selected ? '#fff' : 'var(--text-muted)',
        borderRadius: 999, padding: '4px 12px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
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

function getSuggestedCategories(roomName: string): string[] {
  const lower = roomName.toLowerCase();
  for (const [keyword, cats] of Object.entries(ROOM_TYPE_SUGGESTIONS)) {
    if (lower.includes(keyword)) return cats;
  }
  return [];
}

function RoomForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
  availableCategories,
}: {
  initial: RoomFormState;
  onSave: (f: RoomFormState) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  availableCategories: string[];
}) {
  const [form, setForm] = useState<RoomFormState>(initial);
  const [customTag, setCustomTag] = useState('');
  const [suggestApplied, setSuggestApplied] = useState(false);
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

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !form.categoryNeeds.includes(tag)) {
      set('categoryNeeds', [...form.categoryNeeds, tag]);
    }
    setCustomTag('');
  };

  // Auto-suggest when room name changes
  const suggestions = getSuggestedCategories(form.name);
  const hasSuggestions = suggestions.length > 0 && !suggestApplied && form.categoryNeeds.length === 0;

  const applySuggestions = () => {
    set('categoryNeeds', [...suggestions]);
    setSuggestApplied(true);
  };

  // Custom tags = items in categoryNeeds that aren't in the available list
  const customTags = form.categoryNeeds.filter((c) => !availableCategories.includes(c));

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
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 6 }}>
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
                {['Min ($)', 'Max ($)'][i]}
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

        {/* Auto-suggest banner */}
        {hasSuggestions && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', marginBottom: 10,
            background: 'rgba(158, 124, 63, 0.06)', border: '1px solid rgba(158, 124, 63, 0.18)',
            borderRadius: 8, fontSize: 12.5,
          }}>
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
              Auto-suggest for <strong>{form.name}</strong>: {suggestions.join(', ')}
            </span>
            <button
              type="button"
              onClick={applySuggestions}
              style={{
                border: '1px solid rgba(158, 124, 63, 0.3)', borderRadius: 6,
                background: 'rgba(158, 124, 63, 0.08)', color: '#9E7C3F',
                padding: '3px 10px', fontSize: 11.5, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Apply
            </button>
          </div>
        )}

        {/* Category chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {availableCategories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              selected={form.categoryNeeds.includes(cat)}
              onClick={() => toggleCategory(cat)}
            />
          ))}
          {/* Custom tags that aren't in the available list */}
          {customTags.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              selected={true}
              onClick={() => toggleCategory(cat)}
            />
          ))}
        </div>

        {/* Custom tag input */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            className="input-field"
            type="text"
            placeholder="Add custom item…"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
            style={{ flex: 1, fontSize: 12.5 }}
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={!customTag.trim()}
            style={{
              border: '1px dashed var(--border-strong)', borderRadius: 8,
              background: 'transparent', color: 'var(--text-muted)',
              padding: '5px 12px', fontSize: 12, fontWeight: 600,
              cursor: customTag.trim() ? 'pointer' : 'default',
              opacity: customTag.trim() ? 1 : 0.5,
            }}
          >
            + Add
          </button>
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
          {fieldLabel('Color Palette')}
          <input
            className="input-field"
            placeholder="e.g. Warm neutrals, cream and navy…"
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

const ROOM_ICONS: Record<string, string> = {
  'Living Room': '🛋️', 'Bedroom': '🛏️', 'Kitchen': '🍳', 'Bathroom': '🚿',
  'Dining Room': '🍽️', 'Study': '📚', 'Office': '💼', 'Balcony': '🌿',
  'Master Bedroom': '🛏️', 'Guest Room': '🛋️', 'Nursery': '🧸', 'Patio': '☀️',
  'Foyer': '🚪', 'Library': '📖', 'Gym': '🏋️', 'Laundry': '🧺',
};

function getRoomIcon(name: string) {
  for (const [key, icon] of Object.entries(ROOM_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🏠';
}

function RoomCard({
  room,
  projectId,
  onUpdated,
  onDeleted,
  availableCategories,
}: {
  room: Room;
  projectId: string;
  onUpdated: (r: Room) => void;
  onDeleted: (id: string) => void;
  availableCategories: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const budget = formatBudget(room.budgetMin, room.budgetMax);
  const accent = roomAccentColor(room.name);
  const shortlistCount = room._count?.shortlistItems ?? 0;
  const icon = getRoomIcon(room.name);

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
      <div className="card" style={{ padding: '24px 26px', gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18 }}>
          Edit: {room.name}
        </div>
        <RoomForm
          initial={roomToForm(room)}
          onSave={handleSave}
          onCancel={() => { setEditing(false); setFormError(null); }}
          saving={saving}
          error={formError}
          availableCategories={availableCategories}
        />
      </div>
    );
  }

  const cr = room.clientRequirements;
  const hasReqs = cr && (cr.colorPalette || cr.materialPreferences || cr.functionalConstraints || cr.seatingCapacity != null || (cr.inspirationLinks?.length ?? 0) > 0);

  return (
    <Link href={`/projects/${projectId}/rooms/${room.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' as const }}>
      <div
        className="card"
        style={{
          padding: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column' as const,
          transition: 'transform 0.18s cubic-bezier(.22,1,.36,1), box-shadow 0.18s cubic-bezier(.22,1,.36,1)',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.08)' : undefined,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Top section — icon + name */}
        <div style={{
          padding: '24px 24px 20px',
          background: `linear-gradient(135deg, ${accent}08, ${accent}03)`,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#fff', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 16, fontWeight: 800, color: 'var(--text-primary)',
                letterSpacing: '-0.02em', lineHeight: 1.25,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {room.name}
              </div>
              {(room.areaSqft != null || budget) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {room.areaSqft != null && <span>{room.areaSqft} sq ft</span>}
                  {room.areaSqft != null && budget && <span style={{ margin: '0 6px', opacity: 0.4 }}>/</span>}
                  {budget && <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{budget}</span>}
                </div>
              )}
            </div>
            {shortlistCount > 0 && (
              <div style={{
                background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                borderRadius: 999, padding: '3px 10px',
                fontSize: 11, fontWeight: 700, color: 'var(--gold)', flexShrink: 0,
              }}>
                {shortlistCount} item{shortlistCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Bottom section — stats + chips */}
        <div style={{ padding: '16px 24px 20px', minHeight: 80, flex: 1 }}>
          {/* Dimensions row */}
          {room.lengthFt != null && room.widthFt != null && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600,
              marginBottom: room.categoryNeeds.length > 0 || hasReqs || room.notes ? 14 : 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              {room.lengthFt} × {room.widthFt}{room.heightFt != null ? ` × ${room.heightFt}` : ''} ft
            </div>
          )}

          {/* Category chips */}
          {room.categoryNeeds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: hasReqs || room.notes ? 12 : 0 }}>
              {room.categoryNeeds.map((cat) => (
                <span
                  key={cat}
                  style={{
                    padding: '3px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)',
                    background: 'var(--bg-input)',
                  }}
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Client reqs hint */}
          {hasReqs && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500,
              marginBottom: room.notes ? 8 : 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              Client brief attached
            </div>
          )}

          {/* Notes preview */}
          {room.notes && (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {room.notes}
            </div>
          )}
        </div>

        {/* Hover action buttons */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', gap: 4,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 0.15s, transform 0.15s',
        }}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,0.95)', border: '1px solid var(--border)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', backdropFilter: 'blur(4px)',
              transition: 'all 0.12s',
            }}
            title="Edit"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,0.95)', border: '1px solid var(--border)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', backdropFilter: 'blur(4px)',
              transition: 'all 0.12s',
            }}
            title="Delete"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(180,30,30,0.3)'; e.currentTarget.style.color = '#b41e1e'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>

        {/* Delete error */}
        {deleteError && (
          <div onClick={(e) => e.preventDefault()} style={{
            padding: '0 24px 12px',
            fontSize: 12.5, color: '#b41e1e',
          }}>
            {deleteError}
          </div>
        )}

        {/* Delete confirmation overlay */}
        {confirmDelete && (
          <div onClick={(e) => e.preventDefault()} className="anim-scale-in" style={{
            position: 'absolute', inset: 0, zIndex: 5,
            background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(6px)',
            borderRadius: 12, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Delete &ldquo;{room.name}&rdquo;?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>This action cannot be undone.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
                style={{
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: '#fff', color: 'var(--text-secondary)',
                  padding: '8px 20px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
                disabled={deleting}
                style={{
                  border: 'none', borderRadius: 8,
                  background: '#b41e1e', color: '#fff',
                  padding: '8px 20px', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Link>
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
  const [categoryNames, setCategoryNames] = useState<string[]>(FALLBACK_CATEGORIES);

  useEffect(() => {
    api.getProject(id).then((r) => {
      if (r.data) setRooms(r.data.rooms);
      setLoading(false);
    });
    // Fetch dynamic categories
    api.getFurnitureCategories().then((r) => {
      if (r.data && r.data.length > 0) {
        setCategoryNames(r.data.map((c) => c.name));
      }
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
    <div style={{ padding: '40px 44px', maxWidth: 960 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
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
            availableCategories={categoryNames}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, gridAutoRows: '1fr' }}>
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              projectId={id}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              availableCategories={categoryNames}
            />
          ))}
        </div>
      )}
    </div>
  );
}
