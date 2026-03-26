/**
 * Category-aware attribute configuration for the comparison table.
 *
 * Each category maps to an ordered list of attribute rows that should appear
 * when comparing products of that category. The `key` is used to look up
 * the value from product fields (dimensions, metadata, materials, features, etc.).
 * The `label` is the display name shown in the comparison table.
 *
 * Source: `metadata.*`, `dimensions.*`, `materials.*`, or top-level product fields.
 */

export interface AttributeConfig {
  key: string;
  label: string;
  /** Where to find this value on the product object */
  source: 'metadata' | 'dimensions' | 'materials' | 'top' | 'computed';
}

export const COMMON_ATTRIBUTES: AttributeConfig[] = [
  { key: 'dimensions_display', label: 'Dimensions', source: 'computed' },
  { key: 'material', label: 'Material', source: 'top' },
  { key: 'leadTime', label: 'Lead Time', source: 'top' },
  { key: 'shipping', label: 'Shipping', source: 'top' },
  { key: 'availability', label: 'Availability', source: 'top' },
  { key: 'warranty', label: 'Warranty', source: 'metadata' },
  { key: 'assembly', label: 'Assembly', source: 'metadata' },
];

export const CATEGORY_ATTRIBUTES: Record<string, AttributeConfig[]> = {
  Sofa: [
    { key: 'seatDepth', label: 'Seating Depth', source: 'metadata' },
    { key: 'cushionType', label: 'Cushion Fill', source: 'metadata' },
    { key: 'fabricType', label: 'Upholstery Grade', source: 'metadata' },
    { key: 'seatingCapacity', label: 'Seating Capacity', source: 'metadata' },
    { key: 'armHeight', label: 'Armrest Style', source: 'metadata' },
    { key: 'legMaterial', label: 'Leg Material', source: 'metadata' },
    { key: 'weightCapacity', label: 'Weight Limit', source: 'metadata' },
  ],
  'Dining Table': [
    { key: 'extendable', label: 'Extendable', source: 'metadata' },
    { key: 'extensionMechanism', label: 'Extension Mechanism', source: 'metadata' },
    { key: 'topMaterial', label: 'Top Material', source: 'metadata' },
    { key: 'baseMaterial', label: 'Base Material', source: 'metadata' },
    { key: 'weightCapacity', label: 'Weight Capacity', source: 'metadata' },
    { key: 'shape', label: 'Shape', source: 'metadata' },
  ],
  Bed: [
    { key: 'headboardHeight', label: 'Headboard Height', source: 'metadata' },
    { key: 'storageType', label: 'Storage Type', source: 'metadata' },
    { key: 'slatSpacing', label: 'Slat Spacing', source: 'metadata' },
    { key: 'compatibleMattressSizes', label: 'Compatible Mattress Sizes', source: 'metadata' },
    { key: 'weightCapacity', label: 'Weight Capacity', source: 'metadata' },
    { key: 'assembly', label: 'Assembly Required', source: 'metadata' },
  ],
  Wardrobe: [
    { key: 'internalConfiguration', label: 'Internal Configuration', source: 'metadata' },
    { key: 'doorType', label: 'Door Type', source: 'metadata' },
    { key: 'depth', label: 'Depth', source: 'dimensions' },
    { key: 'adjustableShelves', label: 'Adjustable Shelves', source: 'metadata' },
  ],
  Storage: [
    { key: 'internalConfiguration', label: 'Internal Configuration', source: 'metadata' },
    { key: 'doorType', label: 'Door Type', source: 'metadata' },
    { key: 'depth', label: 'Depth', source: 'dimensions' },
    { key: 'adjustableShelves', label: 'Adjustable Shelves', source: 'metadata' },
  ],
  Lighting: [
    { key: 'bulbType', label: 'Bulb Type', source: 'metadata' },
    { key: 'wattage', label: 'Wattage', source: 'metadata' },
    { key: 'ipRating', label: 'IP Rating', source: 'metadata' },
    { key: 'shadeMaterial', label: 'Shade Material', source: 'metadata' },
    { key: 'dimmerCompatible', label: 'Dimmer Compatible', source: 'metadata' },
  ],
  Rug: [
    { key: 'pileHeight', label: 'Pile Height', source: 'metadata' },
    { key: 'materialComposition', label: 'Material Composition', source: 'metadata' },
    { key: 'weaveType', label: 'Weave Type', source: 'metadata' },
    { key: 'indoorOutdoor', label: 'Indoor / Outdoor', source: 'metadata' },
  ],
  Desk: [
    { key: 'adjustableHeight', label: 'Adjustable Height', source: 'metadata' },
    { key: 'cableManagement', label: 'Cable Management', source: 'metadata' },
    { key: 'drawerCount', label: 'Drawer Count', source: 'metadata' },
    { key: 'topMaterial', label: 'Top Material', source: 'metadata' },
    { key: 'weightCapacity', label: 'Weight Capacity', source: 'metadata' },
  ],
  'Accent Chair': [
    { key: 'seatDepth', label: 'Seat Depth', source: 'metadata' },
    { key: 'seatHeight', label: 'Seat Height', source: 'metadata' },
    { key: 'cushionType', label: 'Cushion Fill', source: 'metadata' },
    { key: 'fabricType', label: 'Upholstery', source: 'metadata' },
    { key: 'legMaterial', label: 'Leg Material', source: 'metadata' },
    { key: 'weightCapacity', label: 'Weight Limit', source: 'metadata' },
  ],
};

/**
 * Returns the attribute rows for a given category, falling back to common-only
 * for unknown categories.
 */
export function getAttributesForCategory(category: string | null | undefined): AttributeConfig[] {
  if (!category) return COMMON_ATTRIBUTES;
  // Try exact match first, then case-insensitive
  const attrs =
    CATEGORY_ATTRIBUTES[category] ??
    CATEGORY_ATTRIBUTES[Object.keys(CATEGORY_ATTRIBUTES).find(
      (k) => k.toLowerCase() === category.toLowerCase(),
    ) ?? ''];
  return [...(attrs ?? []), ...COMMON_ATTRIBUTES];
}

/**
 * Resolve the value of an attribute from a product object.
 * Returns the string value or null if not found.
 */
export function resolveAttributeValue(
  product: {
    dimensions?: { length?: number; width?: number; height?: number; depth?: number; weight?: number; unit?: string; raw?: string } | null;
    metadata?: Record<string, unknown> | null;
    materials?: Record<string, string | string[]> | null;
    material?: string | null;
    leadTime?: string | null;
    shipping?: string | null;
    availability?: string | null;
    features?: string[];
  },
  attr: AttributeConfig,
): { value: string | null; uncertain: boolean } {
  let value: unknown = null;
  let uncertain = false;

  switch (attr.source) {
    case 'metadata':
      value = product.metadata?.[attr.key] ?? null;
      if (value != null) uncertain = true; // AI-extracted metadata
      break;
    case 'dimensions':
      if (attr.key === 'depth') {
        value = product.dimensions?.depth
          ? `${product.dimensions.depth} ${product.dimensions?.unit ?? 'in'}`
          : null;
      } else {
        value = product.dimensions?.[attr.key as keyof typeof product.dimensions] ?? null;
      }
      break;
    case 'materials':
      value = product.materials?.[attr.key] ?? null;
      if (Array.isArray(value)) value = value.join(', ');
      break;
    case 'top':
      value = (product as Record<string, unknown>)[attr.key] ?? null;
      break;
    case 'computed':
      if (attr.key === 'dimensions_display') {
        const d = product.dimensions;
        if (d?.raw) {
          value = d.raw;
        } else if (d) {
          const parts: string[] = [];
          if (d.width) parts.push(`${d.width}W`);
          if (d.depth) parts.push(`${d.depth}D`);
          if (d.height) parts.push(`${d.height}H`);
          if (d.length && !d.depth) parts.push(`${d.length}L`);
          if (parts.length) value = `${parts.join(' x ')} ${d.unit ?? 'in'}`;
        }
      }
      break;
  }

  if (value == null) return { value: null, uncertain: false };
  return { value: String(value), uncertain };
}
