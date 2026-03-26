/**
 * Room Fit Calculation Engine
 *
 * Computes whether a product fits within a room based on its dimensions
 * and interior design clearance standards. Supports category-specific
 * clearance rules (e.g., dining tables need chair pull-out space).
 */

export type FitStatus = 'green' | 'yellow' | 'red' | 'unknown';

export interface FitResult {
  status: FitStatus;
  label: string;
  detail: string;
  /** Minimum clearance in inches on any walkable side */
  minClearanceInches: number | null;
  /** Product footprint in inches */
  productWidthIn: number;
  productDepthIn: number;
}

export interface ProductDimensions {
  width?: number;
  depth?: number;
  length?: number;
  height?: number;
  unit?: string;
}

/* ─── Unit normalization ──────────────────────────── */

/** Convert a dimension value to inches */
function toInches(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'ft':
    case 'feet':
      return value * 12;
    case 'cm':
      return value / 2.54;
    case 'm':
    case 'meter':
    case 'meters':
      return value * 39.3701;
    case 'mm':
      return value / 25.4;
    case 'in':
    case 'inch':
    case 'inches':
    default:
      return value;
  }
}

/** Get product width and depth in inches, returns null if not available */
export function normalizeProductDimensions(
  dims: ProductDimensions | null | undefined,
): { widthIn: number; depthIn: number } | null {
  if (!dims) return null;

  const unit = dims.unit || 'in';
  const w = dims.width;
  const d = dims.depth ?? dims.length; // Use length as fallback for depth

  if (w == null || d == null) return null;
  if (w <= 0 || d <= 0) return null;

  return {
    widthIn: toInches(w, unit),
    depthIn: toInches(d, unit),
  };
}

/* ─── Category-specific clearance rules (inches) ──── */

interface ClearanceRule {
  /** Minimum clearance for green (comfortable) */
  comfortableIn: number;
  /** Minimum clearance for yellow (tight) */
  tightIn: number;
  /** Extra clearance needed on specific sides */
  extraLabel?: string;
  extraIn?: number;
}

const DEFAULT_CLEARANCE: ClearanceRule = {
  comfortableIn: 36,  // 3 ft main walkway
  tightIn: 18,        // 1.5 ft secondary
};

const CATEGORY_CLEARANCE: Record<string, ClearanceRule> = {
  'sofa': {
    comfortableIn: 36,
    tightIn: 18,
  },
  'dining table': {
    comfortableIn: 42,  // 36" chair pull-out + 6" buffer
    tightIn: 36,        // Minimum chair pull-out
    extraLabel: 'chair pull-out clearance',
    extraIn: 36,
  },
  'bed': {
    comfortableIn: 36,
    tightIn: 24,        // Minimum for bedside table access
    extraLabel: 'bedside table clearance',
    extraIn: 24,
  },
  'desk': {
    comfortableIn: 42,  // Chair pull-out
    tightIn: 36,
    extraLabel: 'chair clearance',
    extraIn: 36,
  },
  'wardrobe': {
    comfortableIn: 36,
    tightIn: 24,
    extraLabel: 'door swing clearance',
    extraIn: 30,
  },
  'storage': {
    comfortableIn: 36,
    tightIn: 24,
  },
  'accent chair': {
    comfortableIn: 24,
    tightIn: 18,
  },
  'rug': {
    comfortableIn: 12,  // Rugs just need some floor border
    tightIn: 6,
  },
  'lighting': {
    // Floor lamps, table lamps — very small footprint
    comfortableIn: 12,
    tightIn: 6,
  },
};

function getClearanceRule(category: string | null | undefined): ClearanceRule {
  if (!category) return DEFAULT_CLEARANCE;
  return CATEGORY_CLEARANCE[category.toLowerCase()] ?? DEFAULT_CLEARANCE;
}

/* ─── Fit calculation ─────────────────────────────── */

/**
 * Calculate whether a product fits in a room.
 *
 * @param roomWidthFt  - Room width in feet
 * @param roomLengthFt - Room length in feet
 * @param productDims  - Product dimensions object
 * @param category     - Product category for clearance rules
 */
export function calculateFit(
  roomWidthFt: number | null | undefined,
  roomLengthFt: number | null | undefined,
  productDims: ProductDimensions | null | undefined,
  category?: string | null,
): FitResult {
  const normalized = normalizeProductDimensions(productDims);

  if (!normalized) {
    return {
      status: 'unknown',
      label: 'Dimensions unavailable',
      detail: 'Product dimensions are not available — cannot assess fit.',
      minClearanceInches: null,
      productWidthIn: 0,
      productDepthIn: 0,
    };
  }

  if (roomWidthFt == null || roomLengthFt == null || roomWidthFt <= 0 || roomLengthFt <= 0) {
    return {
      status: 'unknown',
      label: 'Room dimensions unavailable',
      detail: 'Room dimensions are not set — add room dimensions to assess fit.',
      minClearanceInches: null,
      productWidthIn: normalized.widthIn,
      productDepthIn: normalized.depthIn,
    };
  }

  const roomWidthIn = roomWidthFt * 12;
  const roomLengthIn = roomLengthFt * 12;

  const { widthIn, depthIn } = normalized;

  // Available clearance on each axis (total on both sides)
  const widthClearance = roomWidthIn - widthIn;
  const depthClearance = roomLengthIn - depthIn;

  // Minimum clearance on either axis (split across both sides → /2)
  const minClearance = Math.min(widthClearance, depthClearance);

  const rule = getClearanceRule(category);

  let status: FitStatus;
  let label: string;
  let detail: string;

  if (minClearance < 0) {
    status = 'red';
    label = 'Won\'t fit';
    const conflict = widthClearance < depthClearance
      ? `Width exceeds room by ${Math.abs(Math.round(widthClearance))}"`
      : `Depth exceeds room by ${Math.abs(Math.round(depthClearance))}"`;
    detail = `${conflict} — confirm dimensions before proceeding.`;
  } else if (minClearance < rule.tightIn) {
    status = 'red';
    label = 'Won\'t fit';
    detail = `Only ${Math.round(minClearance)}" clearance — below ${rule.tightIn}" minimum${rule.extraLabel ? ` (${rule.extraLabel})` : ''}.`;
  } else if (minClearance < rule.comfortableIn) {
    status = 'yellow';
    label = 'Tight fit';
    detail = `${Math.round(minClearance)}" clearance — workable but tight${rule.extraLabel ? ` for ${rule.extraLabel}` : ''}.`;
  } else {
    status = 'green';
    label = 'Fits comfortably';
    detail = `${Math.round(minClearance)}" clearance available — well within standards.`;
  }

  return {
    status,
    label,
    detail,
    minClearanceInches: Math.round(minClearance),
    productWidthIn: Math.round(widthIn),
    productDepthIn: Math.round(depthIn),
  };
}

/* ─── Auto-layout for multiple products ──────────── */

export type PlacementZone = 'wall-back' | 'wall-left' | 'wall-right' | 'center' | 'floor';

export interface PlacedProduct {
  id: string;
  label: string;
  brand: string | null;
  imageUrl?: string;
  /** Position in inches from room top-left */
  x: number;
  y: number;
  /** Dimensions in inches (after rotation) */
  widthIn: number;
  depthIn: number;
  /** Original dimensions before rotation */
  originalWidthIn: number;
  originalDepthIn: number;
  /** Is rotated 90 degrees */
  rotated: boolean;
  fit: FitResult;
  /** Is this a shortlisted (context) item vs compared item */
  isContext: boolean;
  /** Is this the highlighted/selected product */
  isHighlighted: boolean;
  /** Placement zone used */
  zone: PlacementZone;
  /** Clearance to nearest wall in each direction (inches) */
  clearance: { top: number; right: number; bottom: number; left: number };
  /** True if product dimensions are missing — cannot be rendered on canvas */
  missingDimensions?: boolean;
}

/** Which zone a category prefers for smart placement */
const CATEGORY_ZONE: Record<string, PlacementZone> = {
  'sofa': 'wall-back',
  'bed': 'wall-back',
  'wardrobe': 'wall-left',
  'storage': 'wall-left',
  'bookshelf': 'wall-left',
  'dining table': 'center',
  'desk': 'wall-right',
  'coffee table': 'center',
  'rug': 'floor',
  'accent chair': 'center',
  'lighting': 'wall-right',
};

function getZone(category: string | null | undefined): PlacementZone {
  if (!category) return 'center';
  return CATEGORY_ZONE[category.toLowerCase()] ?? 'center';
}

export interface LayoutItem {
  id: string;
  label: string;
  brand: string | null;
  imageUrl?: string;
  dims: ProductDimensions | null | undefined;
  category?: string | null;
  isContext: boolean;
  isHighlighted: boolean;
  rotated?: boolean;
}

/**
 * Smart auto-layout: places products based on category-aware zones.
 * - Wall-huggers (sofas, beds, wardrobes) go against walls
 * - Center items (dining tables, coffee tables) center in remaining space
 * - Floor items (rugs) center at the bottom
 * Falls back to row-based packing if zones get crowded.
 */
export function autoLayoutProducts(
  roomWidthFt: number,
  roomLengthFt: number,
  items: LayoutItem[],
): PlacedProduct[] {
  const roomWIn = roomWidthFt * 12;
  const roomHIn = roomLengthFt * 12;
  const wallGap = 6;   // 6" from wall for wall-huggers
  const itemGap = 12;  // 12" between products

  const placed: PlacedProduct[] = [];
  // Track occupied regions per zone for stacking
  const wallBackX = { cursor: wallGap };
  const wallLeftY = { cursor: wallGap };
  const wallRightY = { cursor: wallGap };
  let centerIdx = 0;

  // Sort: context items first, then by zone priority (walls → center → floor)
  const zonePriority: Record<PlacementZone, number> = {
    'wall-back': 0, 'wall-left': 1, 'wall-right': 2, 'center': 3, 'floor': 4,
  };
  const sorted = [...items].sort((a, b) => {
    if (a.isContext !== b.isContext) return a.isContext ? -1 : 1;
    return zonePriority[getZone(a.category)] - zonePriority[getZone(b.category)];
  });

  for (const item of sorted) {
    const normalized = normalizeProductDimensions(item.dims);
    if (!normalized) {
      // Still include in output so visibility pills can show it
      placed.push({
        id: item.id,
        label: item.label,
        brand: item.brand,
        imageUrl: item.imageUrl,
        x: 0, y: 0, widthIn: 0, depthIn: 0,
        originalWidthIn: 0, originalDepthIn: 0,
        rotated: false,
        fit: calculateFit(roomWidthFt, roomLengthFt, item.dims, item.category),
        isContext: item.isContext,
        isHighlighted: item.isHighlighted,
        zone: 'center',
        clearance: { top: 0, right: 0, bottom: 0, left: 0 },
        missingDimensions: true,
      });
      continue;
    }

    let wIn = normalized.widthIn;
    let dIn = normalized.depthIn;
    const rotated = item.rotated ?? false;
    if (rotated) [wIn, dIn] = [dIn, wIn];

    const fit = calculateFit(roomWidthFt, roomLengthFt, item.dims, item.category);
    const zone = getZone(item.category);

    let x: number;
    let y: number;

    switch (zone) {
      case 'wall-back':
        // Against top wall, left to right
        x = wallBackX.cursor;
        y = wallGap;
        wallBackX.cursor += wIn + itemGap;
        // Wrap if needed
        if (x + wIn > roomWIn - wallGap) {
          x = wallGap;
          y = wallGap + dIn + itemGap;
          wallBackX.cursor = wallGap + wIn + itemGap;
        }
        break;

      case 'wall-left':
        // Against left wall, top to bottom
        x = wallGap;
        y = Math.max(wallLeftY.cursor, wallGap + dIn + itemGap); // below back-wall items
        wallLeftY.cursor = y + dIn + itemGap;
        break;

      case 'wall-right':
        // Against right wall, top to bottom
        x = roomWIn - wIn - wallGap;
        y = Math.max(wallRightY.cursor, wallGap + 48 + itemGap); // leave space for back-wall items
        wallRightY.cursor = y + dIn + itemGap;
        break;

      case 'floor':
        // Centered at bottom
        x = (roomWIn - wIn) / 2;
        y = roomHIn - dIn - wallGap;
        break;

      case 'center':
      default: {
        // Center area — stagger items
        const centerStartY = Math.max(wallGap + 48, roomHIn * 0.35);
        const cols = Math.max(1, Math.floor((roomWIn - wallGap * 4) / (wIn + itemGap)));
        const col = centerIdx % cols;
        const row = Math.floor(centerIdx / cols);
        const totalRowW = Math.min(cols, items.length) * (wIn + itemGap) - itemGap;
        const startX = (roomWIn - totalRowW) / 2;
        x = startX + col * (wIn + itemGap);
        y = centerStartY + row * (dIn + itemGap);
        centerIdx++;
        break;
      }
    }

    // Clamp to room bounds
    x = Math.max(wallGap, Math.min(x, roomWIn - wIn - wallGap));
    y = Math.max(wallGap, Math.min(y, roomHIn - dIn - wallGap));

    placed.push({
      id: item.id,
      label: item.label,
      brand: item.brand,
      imageUrl: item.imageUrl,
      x,
      y,
      widthIn: Math.round(wIn),
      depthIn: Math.round(dIn),
      originalWidthIn: Math.round(normalized.widthIn),
      originalDepthIn: Math.round(normalized.depthIn),
      rotated,
      fit,
      isContext: item.isContext,
      isHighlighted: item.isHighlighted,
      zone,
      clearance: {
        top: Math.round(y),
        left: Math.round(x),
        right: Math.round(roomWIn - x - wIn),
        bottom: Math.round(roomHIn - y - dIn),
      },
    });
  }

  return placed;
}

/* ─── Floor coverage calculation ─────────────────── */

export function calculateFloorCoverage(
  roomWidthFt: number,
  roomLengthFt: number,
  products: PlacedProduct[],
): { totalSqIn: number; coveredSqIn: number; percentage: number } {
  const totalSqIn = roomWidthFt * 12 * roomLengthFt * 12;
  const coveredSqIn = products.reduce((sum, p) => sum + p.widthIn * p.depthIn, 0);
  return {
    totalSqIn,
    coveredSqIn,
    percentage: totalSqIn > 0 ? Math.round((coveredSqIn / totalSqIn) * 100) : 0,
  };
}
