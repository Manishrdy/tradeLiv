'use client';

import { useMemo, useState, useCallback, useRef, useEffect, type ReactElement } from 'react';
import type { PlacedProduct, FitStatus } from '@/lib/roomFitEngine';
import { calculateFloorCoverage } from '@/lib/roomFitEngine';

/* ═══════════════════════════════════════════════════════
   Room Canvas — SVG-based 2D floor plan (Enhanced)
   ═══════════════════════════════════════════════════════ */

interface RoomCanvasProps {
  roomWidthFt: number;
  roomLengthFt: number;
  roomName?: string;
  products: PlacedProduct[];
  highlightedId?: string | null;
  hiddenIds?: Set<string>;
  onProductClick?: (id: string) => void;
  onRotateProduct?: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  /** Called when a product is dragged to a new position (x, y in inches) */
  onProductMove?: (id: string, xIn: number, yIn: number) => void;
}

/* ─── Colors ──────────────────────────────────────── */

const FIT_COLORS: Record<FitStatus, { fill: string; stroke: string; text: string }> = {
  green: { fill: 'rgba(44,99,71,0.12)', stroke: '#2C6347', text: '#2C6347' },
  yellow: { fill: 'rgba(146,112,12,0.12)', stroke: '#92700C', text: '#92700C' },
  red: { fill: 'rgba(185,28,28,0.10)', stroke: '#b91c1c', text: '#b91c1c' },
  unknown: { fill: 'rgba(0,0,0,0.05)', stroke: '#969696', text: '#969696' },
};

const CONTEXT_COLORS = { fill: 'rgba(0,0,0,0.04)', stroke: 'rgba(0,0,0,0.15)', text: '#969696' };

const FIT_ICONS: Record<FitStatus, string> = {
  green: '✓', yellow: '!', red: '✕', unknown: '?',
};

/* ─── Grid ────────────────────────────────────────── */

function GridLines({ roomWIn, roomHIn, scale }: { roomWIn: number; roomHIn: number; scale: number }) {
  const lines: ReactElement[] = [];
  for (let x = 12; x < roomWIn; x += 12) {
    lines.push(<line key={`v${x}`} x1={x * scale} y1={0} x2={x * scale} y2={roomHIn * scale} stroke="rgba(0,0,0,0.04)" strokeWidth={0.5} />);
  }
  for (let y = 12; y < roomHIn; y += 12) {
    lines.push(<line key={`h${y}`} x1={0} y1={y * scale} x2={roomWIn * scale} y2={y * scale} stroke="rgba(0,0,0,0.04)" strokeWidth={0.5} />);
  }
  return <>{lines}</>;
}

/* ─── Clearance lines ─────────────────────────────── */

function ClearanceLines({ product, scale, roomWIn, roomHIn }: {
  product: PlacedProduct; scale: number; roomWIn: number; roomHIn: number;
}) {
  const px = product.x * scale, py = product.y * scale;
  const pw = product.widthIn * scale, ph = product.depthIn * scale;
  const c = product.clearance;
  const dash = '3 2';
  const color = 'rgba(158,124,63,0.4)';

  const gaps = [
    { dir: 'top', val: c.top, x1: px + pw / 2, y1: 0, x2: px + pw / 2, y2: py, lx: px + pw / 2, ly: py / 2 },
    { dir: 'left', val: c.left, x1: 0, y1: py + ph / 2, x2: px, y2: py + ph / 2, lx: px / 2, ly: py + ph / 2 },
    { dir: 'right', val: c.right, x1: px + pw, y1: py + ph / 2, x2: roomWIn * scale, y2: py + ph / 2, lx: px + pw + (roomWIn * scale - px - pw) / 2, ly: py + ph / 2 },
    { dir: 'bottom', val: c.bottom, x1: px + pw / 2, y1: py + ph, x2: px + pw / 2, y2: roomHIn * scale, lx: px + pw / 2, ly: py + ph + (roomHIn * scale - py - ph) / 2 },
  ].filter((g) => g.val > 0).sort((a, b) => a.val - b.val).slice(0, 2);

  return (
    <g style={{ pointerEvents: 'none' }}>
      {gaps.map((g) => (
        <g key={g.dir}>
          <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={color} strokeWidth={0.8} strokeDasharray={dash} />
          <text x={g.lx} y={g.ly} textAnchor="middle" dominantBaseline="central" fill="var(--gold)" fontSize={7.5} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif">
            {Math.round(g.val)}"
          </text>
        </g>
      ))}
    </g>
  );
}

/* ─── Draggable Product rectangle ─────────────────── */

function ProductRect({
  product, scale, isHighlighted, isDragging,
  onClick, onRotate, onHover, onLeave, onDragStart,
}: {
  product: PlacedProduct; scale: number; isHighlighted: boolean; isDragging: boolean;
  onClick?: () => void; onRotate?: () => void;
  onHover: (p: PlacedProduct, rect: DOMRect) => void; onLeave: () => void;
  onDragStart: (p: PlacedProduct, e: React.MouseEvent) => void;
}) {
  const ref = useRef<SVGGElement>(null);
  const colors = product.isContext ? CONTEXT_COLORS : FIT_COLORS[product.fit.status];

  const x = product.x * scale;
  const y = product.y * scale;
  const w = product.widthIn * scale;
  const h = product.depthIn * scale;

  const strokeWidth = isHighlighted ? 2.5 : isDragging ? 2 : 1.2;
  const labelFontSize = Math.max(7.5, Math.min(11, w / 8));
  const brandFontSize = Math.max(6.5, labelFontSize - 1.5);

  const handleMouseEnter = useCallback(() => {
    if (ref.current && !isDragging) {
      onHover(product, ref.current.getBoundingClientRect());
    }
  }, [product, onHover, isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragStart(product, e);
  }, [product, onDragStart]);

  const clipId = `clip-${product.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const showImage = !!product.imageUrl && w > 40 && h > 40;
  const imgSize = Math.min(w * 0.4, h * 0.4, 36);

  return (
    <g
      ref={ref}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.85 : 1 }}
    >
      {/* Shadow when dragging */}
      {isDragging && (
        <rect x={x + 2} y={y + 2} width={w} height={h} rx={3} fill="rgba(0,0,0,0.08)" />
      )}

      <rect
        x={x} y={y} width={w} height={h} rx={3}
        fill={isHighlighted ? colors.fill.replace(/[\d.]+\)$/, '0.22)') : colors.fill}
        stroke={isDragging ? '#2563eb' : colors.stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={product.isContext ? '4 3' : 'none'}
        style={{ transition: isDragging ? 'none' : 'fill 0.2s, stroke-width 0.2s' }}
      />

      {/* Image thumbnail */}
      {showImage && (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x={x + 4} y={y + 4} width={imgSize} height={imgSize} rx={3} />
            </clipPath>
          </defs>
          <image href={product.imageUrl} x={x + 4} y={y + 4} width={imgSize} height={imgSize}
            clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
            style={{ pointerEvents: 'none', opacity: product.isContext ? 0.4 : 0.85 }} />
        </>
      )}

      {/* Fit icon */}
      {!product.isContext && w > 24 && h > 24 && (
        <g>
          <circle cx={x + w - 8} cy={y + 8} r={6} fill={colors.stroke} opacity={0.9} />
          <text x={x + w - 8} y={y + 8.5} textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize={7} fontWeight={700} fontFamily="Inter, -apple-system, sans-serif"
            style={{ pointerEvents: 'none' }}>
            {FIT_ICONS[product.fit.status]}
          </text>
        </g>
      )}

      {/* Labels */}
      {w > 30 && h > 20 && (
        <>
          <text x={x + w / 2} y={y + h / 2 - (product.brand && h > 35 ? brandFontSize * 0.6 : 0)}
            textAnchor="middle" dominantBaseline="central" fill={colors.text}
            fontSize={labelFontSize} fontWeight={700} fontFamily="Inter, -apple-system, sans-serif"
            style={{ pointerEvents: 'none' }}>
            {truncate(product.label, Math.floor(w / (labelFontSize * 0.55)))}
          </text>
          {product.brand && h > 35 && (
            <text x={x + w / 2} y={y + h / 2 + brandFontSize * 0.8}
              textAnchor="middle" dominantBaseline="central"
              fill={product.isContext ? '#b0b0b0' : colors.text}
              fontSize={brandFontSize} fontWeight={500} opacity={0.7}
              fontFamily="Inter, -apple-system, sans-serif" style={{ pointerEvents: 'none' }}>
              {truncate(product.brand, Math.floor(w / (brandFontSize * 0.55)))}
            </text>
          )}
        </>
      )}

      {/* Rotate button */}
      {onRotate && !product.isContext && w > 36 && h > 36 && !isDragging && (
        <g onClick={(e) => { e.stopPropagation(); onRotate(); }} style={{ cursor: 'pointer' }}>
          <circle cx={x + 10} cy={y + h - 10} r={7} fill="rgba(0,0,0,0.5)" />
          <text x={x + 10} y={y + h - 9.5} textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize={8} fontWeight={700} fontFamily="Inter, -apple-system, sans-serif"
            style={{ pointerEvents: 'none' }}>↻</text>
        </g>
      )}
    </g>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.substring(0, max - 1) + '…';
}

/* ─── Scale indicator ─────────────────────────────── */

function ScaleIndicator({ scale, svgWidth, svgHeight }: { scale: number; svgWidth: number; svgHeight: number }) {
  const barPx = 12 * scale;
  const x = svgWidth - barPx - 16, y = svgHeight - 14;
  return (
    <g>
      <line x1={x} y1={y} x2={x + barPx} y2={y} stroke="#969696" strokeWidth={1.5} />
      <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#969696" strokeWidth={1} />
      <line x1={x + barPx} y1={y - 3} x2={x + barPx} y2={y + 3} stroke="#969696" strokeWidth={1} />
      <text x={x + barPx / 2} y={y - 6} textAnchor="middle" fill="#969696" fontSize={9} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif">1 ft</text>
    </g>
  );
}

/* ─── Tooltip ─────────────────────────────────────── */

function Tooltip({ product, position }: { product: PlacedProduct | null; position: { x: number; y: number } | null }) {
  if (!product || !position) return null;
  const fit = product.fit;
  const badge = FIT_COLORS[fit.status];
  return (
    <div style={{
      position: 'fixed', left: position.x + 12, top: position.y - 8,
      background: '#1a1a1a', color: '#fff', borderRadius: 8,
      padding: '10px 14px', fontSize: 11.5, lineHeight: 1.5,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 100,
      maxWidth: 240, pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>{product.label}</div>
      {product.brand && <div style={{ color: '#aaa', marginBottom: 6 }}>{product.brand}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <span>{product.widthIn}" W × {product.depthIn}" D</span>
        {product.rotated && <span style={{ color: '#aaa', fontSize: 10 }}>(rotated)</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: badge.fill, border: `1px solid ${badge.stroke}`, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>{fit.label}</span>
      </div>
      <div style={{ color: '#bbb', fontSize: 10.5 }}>{fit.detail}</div>
      {fit.minClearanceInches != null && (
        <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>
          Clearance: T {product.clearance.top}" · R {product.clearance.right}" · B {product.clearance.bottom}" · L {product.clearance.left}"
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */

export default function RoomCanvas({
  roomWidthFt, roomLengthFt, roomName, products,
  highlightedId, hiddenIds, onProductClick, onRotateProduct,
  onToggleVisibility, onProductMove,
}: RoomCanvasProps) {
  const PADDING = 32;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width - 32);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const { svgWidth, svgHeight, scale, roomRectW, roomRectH } = useMemo(() => {
    const roomWIn = roomWidthFt * 12, roomHIn = roomLengthFt * 12;
    const maxW = Math.max(containerWidth || 560, 400), maxH = 440;
    const s = Math.min((maxW - PADDING * 2) / roomWIn, (maxH - PADDING * 2) / roomHIn);
    return { svgWidth: roomWIn * s + PADDING * 2, svgHeight: roomHIn * s + PADDING * 2, scale: s, roomRectW: roomWIn * s, roomRectH: roomHIn * s };
  }, [roomWidthFt, roomLengthFt, containerWidth]);

  const roomWIn = roomWidthFt * 12, roomHIn = roomLengthFt * 12;

  // Filter hidden + missing-dimensions products for SVG rendering
  const visibleProducts = useMemo(() => {
    return products.filter((p) => !p.missingDimensions && !(hiddenIds?.has(p.id)));
  }, [products, hiddenIds]);

  // Coverage (only visible)
  const coverage = useMemo(() => calculateFloorCoverage(roomWidthFt, roomLengthFt, visibleProducts), [roomWidthFt, roomLengthFt, visibleProducts]);

  // Tooltip
  const [tooltipProduct, setTooltipProduct] = useState<PlacedProduct | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const handleHover = useCallback((p: PlacedProduct, rect: DOMRect) => {
    setTooltipProduct(p); setTooltipPos({ x: rect.right, y: rect.top });
  }, []);
  const handleLeave = useCallback(() => { setTooltipProduct(null); setTooltipPos(null); }, []);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; origXIn: number; origYIn: number } | null>(null);

  const handleDragStart = useCallback((p: PlacedProduct, e: React.MouseEvent) => {
    if (!onProductMove) return;
    setDragId(p.id);
    setTooltipProduct(null);
    setTooltipPos(null);
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, origXIn: p.x, origYIn: p.y };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current || !svgRef.current) return;
      const dx = (ev.clientX - dragStartRef.current.mouseX) / scale;
      const dy = (ev.clientY - dragStartRef.current.mouseY) / scale;
      let newX = dragStartRef.current.origXIn + dx;
      let newY = dragStartRef.current.origYIn + dy;
      // Clamp to room
      newX = Math.max(0, Math.min(newX, roomWIn - p.widthIn));
      newY = Math.max(0, Math.min(newY, roomHIn - p.depthIn));
      onProductMove(p.id, Math.round(newX), Math.round(newY));
    };

    const handleMouseUp = () => {
      setDragId(null);
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onProductMove, scale, roomWIn, roomHIn]);

  const highlightedProduct = visibleProducts.find((p) => p.id === highlightedId && !p.isContext);

  // All products for the visibility controls (compared + context)
  const compareProducts = products.filter((p) => !p.isContext);
  const contextProducts = products.filter((p) => p.isContext && !p.missingDimensions);

  return (
    <div ref={containerRef} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: 16, overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Room Layout</span>
          {roomName && (
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {roomName}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {roomWidthFt} × {roomLengthFt} ft ({Math.round(roomWidthFt * roomLengthFt)} sq ft)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{coverage.percentage}% floor covered</span>
          <span style={{ width: 1, height: 12, background: 'var(--border)', display: 'inline-block' }} />
          {([
            { label: 'Fits', s: FIT_COLORS.green, dashed: false },
            { label: 'Tight', s: FIT_COLORS.yellow, dashed: false },
            { label: "Won't fit", s: FIT_COLORS.red, dashed: false },
            { label: 'Shortlisted', s: CONTEXT_COLORS, dashed: true },
          ] as const).map(({ label, s, dashed }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.fill, border: `1px ${dashed ? 'dashed' : 'solid'} ${s.stroke}`, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Visibility toggle pills */}
      {onToggleVisibility && compareProducts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>Show:</span>
          {compareProducts.map((p) => {
            const hidden = hiddenIds?.has(p.id) ?? false;
            const noDims = p.missingDimensions;
            const fitColor = noDims ? FIT_COLORS.unknown : FIT_COLORS[p.fit.status];
            return (
              <button
                key={p.id}
                onClick={() => noDims ? undefined : onToggleVisibility(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 999,
                  border: `1px solid ${hidden || noDims ? 'var(--border)' : fitColor.stroke}`,
                  background: hidden || noDims ? 'transparent' : fitColor.fill,
                  color: hidden || noDims ? 'var(--text-placeholder)' : fitColor.text,
                  fontSize: 11, fontWeight: 600,
                  cursor: noDims ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  textDecoration: hidden ? 'line-through' : 'none',
                  opacity: hidden || noDims ? 0.5 : 1,
                }}
                title={noDims ? 'No dimensions available — cannot place in layout' : hidden ? 'Click to show' : 'Click to hide'}
              >
                {noDims ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                ) : hidden ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
                {truncate(p.label, 20)}
                {noDims && <span style={{ fontSize: 9, opacity: 0.7 }}>(no dims)</span>}
              </button>
            );
          })}
          {/* Context (shortlisted) items — also toggleable */}
          {contextProducts.length > 0 && (
            <>
              <span style={{ width: 1, height: 14, background: 'var(--border)', display: 'inline-block', margin: '0 2px' }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-placeholder)', marginRight: 2 }}>Shortlisted:</span>
              {contextProducts.map((p) => {
                const hidden = hiddenIds?.has(p.id) ?? false;
                return (
                  <button
                    key={p.id}
                    onClick={() => onToggleVisibility(p.id)}
                    title={hidden ? 'Click to show' : 'Click to hide'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 999,
                      border: `1px ${hidden ? 'solid' : 'dashed'} ${hidden ? 'var(--border)' : 'rgba(0,0,0,0.2)'}`,
                      background: hidden ? 'transparent' : 'rgba(0,0,0,0.03)',
                      color: hidden ? 'var(--text-placeholder)' : 'var(--text-muted)',
                      fontSize: 10.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                      textDecoration: hidden ? 'line-through' : 'none',
                      opacity: hidden ? 0.45 : 0.75,
                    }}
                  >
                    {hidden ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                    {truncate(p.label, 18)}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={svgWidth} height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%', userSelect: 'none' }}
      >
        {/* Room perimeter */}
        <rect x={PADDING} y={PADDING} width={roomRectW} height={roomRectH} rx={2} fill="#FAFAF8" stroke="var(--text-primary)" strokeWidth={1.5} />

        {/* Grid */}
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          <GridLines roomWIn={roomWIn} roomHIn={roomHIn} scale={scale} />
        </g>

        {/* Clearance lines for highlighted product */}
        {highlightedProduct && (
          <g transform={`translate(${PADDING}, ${PADDING})`}>
            <ClearanceLines product={highlightedProduct} scale={scale} roomWIn={roomWIn} roomHIn={roomHIn} />
          </g>
        )}

        {/* Products */}
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          {visibleProducts.map((p) => (
            <ProductRect
              key={p.id}
              product={p}
              scale={scale}
              isHighlighted={highlightedId === p.id}
              isDragging={dragId === p.id}
              onClick={onProductClick && !p.isContext ? () => onProductClick(p.id) : undefined}
              onRotate={onRotateProduct && !p.isContext ? () => onRotateProduct(p.id) : undefined}
              onHover={handleHover}
              onLeave={handleLeave}
              onDragStart={handleDragStart}
            />
          ))}
        </g>

        {/* Dimension labels */}
        <text x={PADDING + roomRectW / 2} y={PADDING - 10} textAnchor="middle" fill="#969696" fontSize={10} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif">{roomWidthFt} ft</text>
        <text x={PADDING - 10} y={PADDING + roomRectH / 2} textAnchor="middle" fill="#969696" fontSize={10} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif"
          transform={`rotate(-90, ${PADDING - 10}, ${PADDING + roomRectH / 2})`}>{roomLengthFt} ft</text>

        {/* Room name watermark */}
        {roomName && <text x={PADDING + 8} y={PADDING + 14} fill="rgba(0,0,0,0.12)" fontSize={11} fontWeight={700} fontFamily="Inter, -apple-system, sans-serif">{roomName}</text>}

        {/* Scale indicator */}
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          <ScaleIndicator scale={scale} svgWidth={roomRectW} svgHeight={roomRectH} />
        </g>
      </svg>

      {/* Drag hint */}
      {onProductMove && !dragId && (
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: 'var(--text-placeholder)' }}>
          Drag products to reposition · Click to highlight · ↻ to rotate
        </div>
      )}

      {/* Tooltip */}
      <Tooltip product={tooltipProduct} position={tooltipPos} />
    </div>
  );
}
