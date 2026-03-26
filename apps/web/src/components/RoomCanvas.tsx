'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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
  onProductClick?: (id: string) => void;
  onRotateProduct?: (id: string) => void;
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
  green: '✓',
  yellow: '!',
  red: '✕',
  unknown: '?',
};

/* ─── Grid ────────────────────────────────────────── */

function GridLines({ roomWIn, roomHIn, scale }: { roomWIn: number; roomHIn: number; scale: number }) {
  const gridSpacingIn = 12;
  const lines: JSX.Element[] = [];
  for (let x = gridSpacingIn; x < roomWIn; x += gridSpacingIn) {
    lines.push(<line key={`v${x}`} x1={x * scale} y1={0} x2={x * scale} y2={roomHIn * scale} stroke="rgba(0,0,0,0.04)" strokeWidth={0.5} />);
  }
  for (let y = gridSpacingIn; y < roomHIn; y += gridSpacingIn) {
    lines.push(<line key={`h${y}`} x1={0} y1={y * scale} x2={roomWIn * scale} y2={y * scale} stroke="rgba(0,0,0,0.04)" strokeWidth={0.5} />);
  }
  return <>{lines}</>;
}

/* ─── Clearance lines (#1) ────────────────────────── */

function ClearanceLines({ product, scale, roomWIn, roomHIn }: {
  product: PlacedProduct;
  scale: number;
  roomWIn: number;
  roomHIn: number;
}) {
  const { x, y, widthIn, depthIn, clearance } = product;
  const px = x * scale;
  const py = y * scale;
  const pw = widthIn * scale;
  const ph = depthIn * scale;
  const dash = '3 2';
  const color = 'rgba(158,124,63,0.4)';
  const fontSize = 7.5;

  // Only show the nearest wall clearance (smallest gap)
  const gaps = [
    { dir: 'top', val: clearance.top, x1: px + pw / 2, y1: 0, x2: px + pw / 2, y2: py, labelX: px + pw / 2, labelY: py / 2 },
    { dir: 'left', val: clearance.left, x1: 0, y1: py + ph / 2, x2: px, y2: py + ph / 2, labelX: px / 2, labelY: py + ph / 2 },
    { dir: 'right', val: clearance.right, x1: px + pw, y1: py + ph / 2, x2: roomWIn * scale, y2: py + ph / 2, labelX: px + pw + (roomWIn * scale - px - pw) / 2, labelY: py + ph / 2 },
    { dir: 'bottom', val: clearance.bottom, x1: px + pw / 2, y1: py + ph, x2: px + pw / 2, y2: roomHIn * scale, labelX: px + pw / 2, labelY: py + ph + (roomHIn * scale - py - ph) / 2 },
  ].filter((g) => g.val > 0);

  // Show the two smallest
  gaps.sort((a, b) => a.val - b.val);
  const show = gaps.slice(0, 2);

  return (
    <g style={{ pointerEvents: 'none' }}>
      {show.map((g) => (
        <g key={g.dir}>
          <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={color} strokeWidth={0.8} strokeDasharray={dash} />
          <text x={g.labelX} y={g.labelY} textAnchor="middle" dominantBaseline="central" fill="var(--gold)" fontSize={fontSize} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif">
            {Math.round(g.val)}"
          </text>
        </g>
      ))}
    </g>
  );
}

/* ─── Product rectangle (#2 tooltip, #6 image, #7 icon, #8 anim, #10 rotate) ── */

function ProductRect({
  product,
  scale,
  isHighlighted,
  onClick,
  onRotate,
  onHover,
  onLeave,
}: {
  product: PlacedProduct;
  scale: number;
  isHighlighted: boolean;
  onClick?: () => void;
  onRotate?: () => void;
  onHover: (p: PlacedProduct, rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const ref = useRef<SVGGElement>(null);
  const colors = product.isContext ? CONTEXT_COLORS : FIT_COLORS[product.fit.status];

  const x = product.x * scale;
  const y = product.y * scale;
  const w = product.widthIn * scale;
  const h = product.depthIn * scale;

  const strokeWidth = isHighlighted ? 2.5 : 1.2;
  const labelFontSize = Math.max(7.5, Math.min(11, w / 8));
  const brandFontSize = Math.max(6.5, labelFontSize - 1.5);

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      onHover(product, rect);
    }
  }, [product, onHover]);

  // Image clip ID (unique per product)
  const clipId = `clip-${product.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const showImage = !!product.imageUrl && w > 40 && h > 40;
  const imgSize = Math.min(w * 0.4, h * 0.4, 36);

  return (
    <g
      ref={ref}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* #8 — Animated entrance */}
      <animateTransform attributeName="transform" type="scale" from="0.92" to="1" dur="0.3s" fill="freeze" />

      {/* Product rectangle */}
      <rect
        x={x} y={y} width={w} height={h} rx={3}
        fill={isHighlighted ? colors.fill.replace(/[\d.]+\)$/, '0.22)') : colors.fill}
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={product.isContext ? '4 3' : 'none'}
        style={{ transition: 'fill 0.2s, stroke-width 0.2s' }}
      />

      {/* #6 — Product image thumbnail */}
      {showImage && (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x={x + 4} y={y + 4} width={imgSize} height={imgSize} rx={3} />
            </clipPath>
          </defs>
          <image
            href={product.imageUrl}
            x={x + 4} y={y + 4}
            width={imgSize} height={imgSize}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            style={{ pointerEvents: 'none', opacity: product.isContext ? 0.4 : 0.85 }}
          />
        </>
      )}

      {/* #7 — Fit status icon in top-right corner */}
      {!product.isContext && w > 24 && h > 24 && (
        <g>
          <circle
            cx={x + w - 8} cy={y + 8} r={6}
            fill={colors.stroke}
            opacity={0.9}
          />
          <text
            x={x + w - 8} y={y + 8.5}
            textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize={7} fontWeight={700}
            fontFamily="Inter, -apple-system, sans-serif"
            style={{ pointerEvents: 'none' }}
          >
            {FIT_ICONS[product.fit.status]}
          </text>
        </g>
      )}

      {/* Labels */}
      {w > 30 && h > 20 && (
        <>
          <text
            x={x + w / 2} y={y + h / 2 - (product.brand && h > 35 ? brandFontSize * 0.6 : 0)}
            textAnchor="middle" dominantBaseline="central"
            fill={colors.text} fontSize={labelFontSize} fontWeight={700}
            fontFamily="Inter, -apple-system, sans-serif"
            style={{ pointerEvents: 'none' }}
          >
            {truncate(product.label, Math.floor(w / (labelFontSize * 0.55)))}
          </text>
          {product.brand && h > 35 && (
            <text
              x={x + w / 2} y={y + h / 2 + brandFontSize * 0.8}
              textAnchor="middle" dominantBaseline="central"
              fill={product.isContext ? '#b0b0b0' : colors.text}
              fontSize={brandFontSize} fontWeight={500} opacity={0.7}
              fontFamily="Inter, -apple-system, sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              {truncate(product.brand, Math.floor(w / (brandFontSize * 0.55)))}
            </text>
          )}
        </>
      )}

      {/* #10 — Rotate button (bottom-left corner) */}
      {onRotate && !product.isContext && w > 36 && h > 36 && (
        <g
          onClick={(e) => { e.stopPropagation(); onRotate(); }}
          style={{ cursor: 'pointer' }}
        >
          <circle cx={x + 10} cy={y + h - 10} r={7} fill="rgba(0,0,0,0.5)" />
          <text
            x={x + 10} y={y + h - 9.5}
            textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize={8} fontWeight={700}
            fontFamily="Inter, -apple-system, sans-serif"
            style={{ pointerEvents: 'none' }}
          >
            ↻
          </text>
        </g>
      )}
    </g>
  );
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

/* ─── Scale indicator ─────────────────────────────── */

function ScaleIndicator({ scale, svgWidth, svgHeight }: { scale: number; svgWidth: number; svgHeight: number }) {
  const barPx = 12 * scale;
  const x = svgWidth - barPx - 16;
  const y = svgHeight - 14;
  return (
    <g>
      <line x1={x} y1={y} x2={x + barPx} y2={y} stroke="#969696" strokeWidth={1.5} />
      <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#969696" strokeWidth={1} />
      <line x1={x + barPx} y1={y - 3} x2={x + barPx} y2={y + 3} stroke="#969696" strokeWidth={1} />
      <text x={x + barPx / 2} y={y - 6} textAnchor="middle" fill="#969696" fontSize={9} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif">
        1 ft
      </text>
    </g>
  );
}

/* ─── Tooltip (#2) ────────────────────────────────── */

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
  roomWidthFt,
  roomLengthFt,
  roomName,
  products,
  highlightedId,
  onProductClick,
  onRotateProduct,
}: RoomCanvasProps) {
  const PADDING = 32;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // #4 — Responsive: observe container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width - 32); // minus padding
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { svgWidth, svgHeight, scale, roomRectW, roomRectH } = useMemo(() => {
    const roomWIn = roomWidthFt * 12;
    const roomHIn = roomLengthFt * 12;

    const maxW = Math.max(containerWidth || 560, 400);
    const maxH = 440;

    const availW = maxW - PADDING * 2;
    const availH = maxH - PADDING * 2;

    const s = Math.min(availW / roomWIn, availH / roomHIn);
    return {
      svgWidth: roomWIn * s + PADDING * 2,
      svgHeight: roomHIn * s + PADDING * 2,
      scale: s,
      roomRectW: roomWIn * s,
      roomRectH: roomHIn * s,
    };
  }, [roomWidthFt, roomLengthFt, containerWidth]);

  const roomWIn = roomWidthFt * 12;
  const roomHIn = roomLengthFt * 12;

  // #9 — Floor coverage
  const coverage = useMemo(() => calculateFloorCoverage(roomWidthFt, roomLengthFt, products), [roomWidthFt, roomLengthFt, products]);

  // #2 — Tooltip state
  const [tooltipProduct, setTooltipProduct] = useState<PlacedProduct | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleHover = useCallback((p: PlacedProduct, rect: DOMRect) => {
    setTooltipProduct(p);
    setTooltipPos({ x: rect.right, y: rect.top });
  }, []);
  const handleLeave = useCallback(() => {
    setTooltipProduct(null);
    setTooltipPos(null);
  }, []);

  const highlightedProduct = products.find((p) => p.id === highlightedId && !p.isContext);

  return (
    <div ref={containerRef} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: 16, overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Room Layout</span>
          {/* #5 — Room name */}
          {roomName && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>
              {roomName}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {roomWidthFt} × {roomLengthFt} ft ({Math.round(roomWidthFt * roomLengthFt)} sq ft)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          {/* #9 — Coverage stat */}
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            {coverage.percentage}% floor covered
          </span>
          <span style={{ width: 1, height: 12, background: 'var(--border)', display: 'inline-block' }} />
          {/* Legend */}
          {([
            { label: 'Fits', s: FIT_COLORS.green },
            { label: 'Tight', s: FIT_COLORS.yellow },
            { label: "Won't fit", s: FIT_COLORS.red },
            { label: 'Shortlisted', s: CONTEXT_COLORS, dashed: true },
          ] as const).map(({ label, s, dashed }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.fill, border: `1px ${dashed ? 'dashed' : 'solid'} ${s.stroke}`, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
      >
        {/* Room perimeter */}
        <rect x={PADDING} y={PADDING} width={roomRectW} height={roomRectH} rx={2} fill="#FAFAF8" stroke="var(--text-primary)" strokeWidth={1.5} />

        {/* Grid */}
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          <GridLines roomWIn={roomWIn} roomHIn={roomHIn} scale={scale} />
        </g>

        {/* #1 — Clearance lines for highlighted product */}
        {highlightedProduct && (
          <g transform={`translate(${PADDING}, ${PADDING})`}>
            <ClearanceLines product={highlightedProduct} scale={scale} roomWIn={roomWIn} roomHIn={roomHIn} />
          </g>
        )}

        {/* Products */}
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          {products.map((p) => (
            <ProductRect
              key={p.id}
              product={p}
              scale={scale}
              isHighlighted={highlightedId === p.id}
              onClick={onProductClick && !p.isContext ? () => onProductClick(p.id) : undefined}
              onRotate={onRotateProduct && !p.isContext ? () => onRotateProduct(p.id) : undefined}
              onHover={handleHover}
              onLeave={handleLeave}
            />
          ))}
        </g>

        {/* Dimension labels */}
        <text x={PADDING + roomRectW / 2} y={PADDING - 10} textAnchor="middle" fill="#969696" fontSize={10} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif">
          {roomWidthFt} ft
        </text>
        <text x={PADDING - 10} y={PADDING + roomRectH / 2} textAnchor="middle" fill="#969696" fontSize={10} fontWeight={600} fontFamily="Inter, -apple-system, sans-serif"
          transform={`rotate(-90, ${PADDING - 10}, ${PADDING + roomRectH / 2})`}>
          {roomLengthFt} ft
        </text>

        {/* #5 — Room name on canvas */}
        {roomName && (
          <text x={PADDING + 8} y={PADDING + 14} fill="rgba(0,0,0,0.12)" fontSize={11} fontWeight={700} fontFamily="Inter, -apple-system, sans-serif">
            {roomName}
          </text>
        )}

        {/* Scale indicator */}
        <g transform={`translate(${PADDING}, ${PADDING})`}>
          <ScaleIndicator scale={scale} svgWidth={roomRectW} svgHeight={roomRectH} />
        </g>
      </svg>

      {/* #2 — Tooltip (rendered outside SVG for proper layering) */}
      <Tooltip product={tooltipProduct} position={tooltipPos} />
    </div>
  );
}
