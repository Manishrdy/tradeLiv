import PDFDocument from 'pdfkit';
import logger from '../config/logger';

/* ─── Types ──────────────────────────────────────────── */

interface PdfDesigner {
  fullName: string;
  businessName?: string | null;
  email: string;
  phone?: string | null;
}

interface PdfClient {
  name: string;
  email?: string | null;
  phone?: string | null;
  shippingAddress?: any;
}

interface PdfProduct {
  productName: string;
  brandName?: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string;
  activeVariant?: any;
  images?: any;
  imageUrl?: string | null;
  dimensions?: any;
  material?: string | null;
  materials?: any;
  finishes?: string[];
  features?: string[];
  leadTime?: string | null;
  shipping?: string | null;
  availability?: string | null;
  metadata?: any;
  pricing?: any[];
}

interface PdfShortlistItem {
  id: string;
  quantity: number;
  status: string;
  designerNotes?: string | null;
  sharedNotes?: string | null;
  fitAssessment?: string | null;
  priorityRank?: number | null;
  isPinned: boolean;
  selectedVariant?: any;
  product: PdfProduct;
}

interface PdfRoom {
  id: string;
  name: string;
  lengthFt?: number | null;
  widthFt?: number | null;
  heightFt?: number | null;
  areaSqft?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  categoryNeeds: string[];
  notes?: string | null;
  clientRequirements?: any;
  shortlistItems: PdfShortlistItem[];
}

interface PdfProject {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  stylePreference?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectPdfData {
  project: PdfProject;
  designer: PdfDesigner;
  client: PdfClient;
  rooms: PdfRoom[];
}

export interface RoomPdfData {
  project: PdfProject;
  designer: PdfDesigner;
  client: PdfClient;
  room: PdfRoom;
}

/* ─── Helpers ────────────────────────────────────────── */

const COLORS = {
  primary: '#1a1a1a',
  secondary: '#555555',
  muted: '#888888',
  accent: '#c8a45a',
  border: '#e0e0e0',
  lightBg: '#f8f7f5',
  white: '#ffffff',
  green: '#22763d',
  red: '#b33',
  blue: '#2563eb',
};

function formatPrice(price: number | null | undefined, currency?: string): string {
  if (price == null) return '—';
  const c = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

function getProductPrice(product: PdfProduct): number | null {
  if (product.activeVariant && typeof product.activeVariant === 'object') {
    const av = product.activeVariant as Record<string, unknown>;
    if (typeof av.price === 'number') return av.price;
  }
  if (typeof product.price === 'number') return product.price;
  if (product.pricing && product.pricing.length > 0) {
    const first = product.pricing[0];
    if (typeof first.price === 'number') return first.price;
  }
  return null;
}

function formatDimensions(d: any): string {
  if (!d) return '—';
  const unit = d.unit || 'in';
  const parts: string[] = [];
  if (d.width) parts.push(`W: ${d.width}${unit}`);
  if (d.depth) parts.push(`D: ${d.depth}${unit}`);
  if (d.length && !d.depth) parts.push(`L: ${d.length}${unit}`);
  if (d.height) parts.push(`H: ${d.height}${unit}`);
  return parts.length > 0 ? parts.join(' × ') : (d.raw || '—');
}

function formatBudget(min: number | null | undefined, max: number | null | undefined): string {
  if (min != null && max != null) return `${formatPrice(min)} – ${formatPrice(max)}`;
  if (min != null) return `From ${formatPrice(min)}`;
  if (max != null) return `Up to ${formatPrice(max)}`;
  return '—';
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    suggested: 'Suggested',
    approved: 'Approved',
    rejected: 'Rejected',
    added_to_cart: 'In Cart',
    ordered: 'Ordered',
    draft: 'Draft',
    active: 'Active',
    closed: 'Closed',
  };
  return map[s] || s;
}

/* ─── PDF Builder ────────────────────────────────────── */

function createDoc(): InstanceType<typeof PDFDocument> {
  return new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
    info: {
      Title: 'tradeLiv Proposal',
      Author: 'tradeLiv',
      Creator: 'tradeLiv',
    },
  });
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, designer: PdfDesigner) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Brand name
  doc.fontSize(22).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('tradeLiv', doc.page.margins.left, doc.page.margins.top);

  // Designer info on the right
  const rightX = doc.page.margins.left + pageWidth - 200;
  doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
    .text(designer.fullName, rightX, doc.page.margins.top, { width: 200, align: 'right' });
  if (designer.businessName) {
    doc.text(designer.businessName, rightX, doc.y, { width: 200, align: 'right' });
  }
  doc.text(designer.email, rightX, doc.y, { width: 200, align: 'right' });
  if (designer.phone) {
    doc.text(designer.phone, rightX, doc.y, { width: 200, align: 'right' });
  }

  // Divider
  doc.moveDown(0.5);
  const divY = doc.y;
  doc.moveTo(doc.page.margins.left, divY)
    .lineTo(doc.page.margins.left + pageWidth, divY)
    .strokeColor(COLORS.accent)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.8);
}

function drawProjectInfo(doc: InstanceType<typeof PDFDocument>, data: { project: PdfProject; client: PdfClient }) {
  const { project, client } = data;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.fontSize(18).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text(project.name);
  doc.moveDown(0.3);

  // Two-column info
  const colWidth = pageWidth / 2;
  const startY = doc.y;
  const leftX = doc.page.margins.left;
  const rightX = leftX + colWidth;

  doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica');

  // Left column - Project details
  doc.text('CLIENT', leftX, startY);
  doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text(client.name, leftX, doc.y);
  if (client.email) {
    doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
      .text(client.email);
  }
  if (client.phone) {
    doc.text(client.phone);
  }

  const leftEndY = doc.y;

  // Right column
  doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica')
    .text('BUDGET', rightX, startY, { width: colWidth });
  doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text(formatBudget(project.budgetMin, project.budgetMax), rightX, doc.y, { width: colWidth });

  if (project.stylePreference) {
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica')
      .text('STYLE', rightX, doc.y, { width: colWidth });
    doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica')
      .text(project.stylePreference, rightX, doc.y, { width: colWidth });
  }

  doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica');
  doc.moveDown(0.3);
  doc.text('STATUS', rightX, doc.y, { width: colWidth });
  doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica')
    .text(statusLabel(project.status), rightX, doc.y, { width: colWidth });

  doc.moveDown(0.3);
  doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica')
    .text('DATE', rightX, doc.y, { width: colWidth });
  doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica')
    .text(formatDate(project.createdAt), rightX, doc.y, { width: colWidth });

  doc.y = Math.max(doc.y, leftEndY);

  if (project.description) {
    doc.moveDown(0.8);
    doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica')
      .text('DESCRIPTION');
    doc.fontSize(10).fillColor(COLORS.secondary).font('Helvetica')
      .text(project.description, { width: pageWidth });
  }

  doc.moveDown(1);

  // Divider
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.8);
}

function drawRoomSection(doc: InstanceType<typeof PDFDocument>, room: PdfRoom, roomIndex: number) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftX = doc.page.margins.left;

  // Check if we need a new page (at least 120pt needed for room header + 1 product)
  if (doc.y > doc.page.height - 180) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }

  // Room header background
  const roomHeaderY = doc.y;
  doc.rect(leftX, roomHeaderY, pageWidth, 45)
    .fillColor(COLORS.lightBg)
    .fill();

  // Room name
  doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text(room.name, leftX + 12, roomHeaderY + 8, { width: pageWidth - 24 });

  // Room meta line
  const metaParts: string[] = [];
  if (room.lengthFt && room.widthFt) {
    metaParts.push(`${room.lengthFt}' × ${room.widthFt}'${room.heightFt ? ` × ${room.heightFt}'` : ''}`);
  }
  if (room.areaSqft) metaParts.push(`${room.areaSqft} sq ft`);
  if (room.budgetMin != null || room.budgetMax != null) {
    metaParts.push(`Budget: ${formatBudget(room.budgetMin, room.budgetMax)}`);
  }

  if (metaParts.length > 0) {
    doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica')
      .text(metaParts.join('  ·  '), leftX + 12, doc.y + 2, { width: pageWidth - 24 });
  }

  doc.y = roomHeaderY + 50;

  // Category needs
  if (room.categoryNeeds && room.categoryNeeds.length > 0) {
    doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
      .text('Needs: ' + room.categoryNeeds.join(', '), leftX + 12, doc.y, { width: pageWidth - 24 });
    doc.moveDown(0.3);
  }

  // Client requirements
  if (room.clientRequirements) {
    const cr = room.clientRequirements;
    const reqParts: string[] = [];
    if (cr.colorPalette) reqParts.push(`Colors: ${cr.colorPalette}`);
    if (cr.materialPreferences) reqParts.push(`Materials: ${cr.materialPreferences}`);
    if (cr.seatingCapacity) reqParts.push(`Seating: ${cr.seatingCapacity}`);
    if (reqParts.length > 0) {
      doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
        .text(reqParts.join('  ·  '), leftX + 12, doc.y, { width: pageWidth - 24 });
      doc.moveDown(0.3);
    }
  }

  doc.moveDown(0.4);

  // Products table
  if (room.shortlistItems.length === 0) {
    doc.fontSize(10).fillColor(COLORS.muted).font('Helvetica')
      .text('No products shortlisted yet.', leftX + 12, doc.y);
    doc.moveDown(1);
    return;
  }

  // Table header
  const cols = {
    name: { x: leftX, w: pageWidth * 0.32 },
    brand: { x: leftX + pageWidth * 0.32, w: pageWidth * 0.14 },
    dims: { x: leftX + pageWidth * 0.46, w: pageWidth * 0.2 },
    qty: { x: leftX + pageWidth * 0.66, w: pageWidth * 0.08 },
    price: { x: leftX + pageWidth * 0.74, w: pageWidth * 0.13 },
    status: { x: leftX + pageWidth * 0.87, w: pageWidth * 0.13 },
  };

  const headerY = doc.y;
  doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Bold');
  doc.text('PRODUCT', cols.name.x + 4, headerY, { width: cols.name.w });
  doc.text('BRAND', cols.brand.x, headerY, { width: cols.brand.w });
  doc.text('DIMENSIONS', cols.dims.x, headerY, { width: cols.dims.w });
  doc.text('QTY', cols.qty.x, headerY, { width: cols.qty.w, align: 'center' });
  doc.text('PRICE', cols.price.x, headerY, { width: cols.price.w, align: 'right' });
  doc.text('STATUS', cols.status.x, headerY, { width: cols.status.w, align: 'right' });

  doc.y = headerY + 12;
  doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y)
    .strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.y += 4;

  // Product rows
  let totalForRoom = 0;

  for (const item of room.shortlistItems) {
    // Check page break
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }

    const rowY = doc.y;
    const price = getProductPrice(item.product);
    const lineTotal = price != null ? price * item.quantity : null;
    if (lineTotal != null && (item.status === 'approved' || item.status === 'added_to_cart' || item.status === 'ordered')) {
      totalForRoom += lineTotal;
    }

    // Product name (may wrap)
    doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text(item.product.productName, cols.name.x + 4, rowY, { width: cols.name.w - 8 });
    const nameEndY = doc.y;

    doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica');
    doc.text(item.product.brandName || '—', cols.brand.x, rowY, { width: cols.brand.w - 4 });
    doc.text(formatDimensions(item.product.dimensions), cols.dims.x, rowY, { width: cols.dims.w - 4 });
    doc.text(String(item.quantity), cols.qty.x, rowY, { width: cols.qty.w, align: 'center' });
    doc.text(formatPrice(price, item.product.currency), cols.price.x, rowY, { width: cols.price.w, align: 'right' });

    // Status with color
    const statusColor = item.status === 'approved' ? COLORS.green : item.status === 'rejected' ? COLORS.red : COLORS.secondary;
    doc.fillColor(statusColor).text(statusLabel(item.status), cols.status.x, rowY, { width: cols.status.w, align: 'right' });

    doc.y = Math.max(doc.y, nameEndY);

    // Notes row (if any)
    const notes: string[] = [];
    if (item.sharedNotes) notes.push(item.sharedNotes);
    if (item.fitAssessment) notes.push(`Fit: ${item.fitAssessment}`);
    if (item.product.material) notes.push(`Material: ${item.product.material}`);
    if (item.product.leadTime) notes.push(`Lead time: ${item.product.leadTime}`);

    if (notes.length > 0) {
      doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
        .text(notes.join('  ·  '), cols.name.x + 4, doc.y + 1, { width: pageWidth - 8 });
    }

    doc.moveDown(0.3);

    // Row separator
    doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y)
      .strokeColor('#eeeeee').lineWidth(0.3).stroke();
    doc.y += 4;
  }

  // Room total
  if (totalForRoom > 0) {
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text(`Room Total (approved items): ${formatPrice(totalForRoom)}`, leftX + 4, doc.y, {
        width: pageWidth - 8,
        align: 'right',
      });
  }

  doc.moveDown(1.2);
}

function drawFooter(doc: InstanceType<typeof PDFDocument>) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const y = doc.page.height - 35;

    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(
        `Generated by tradeLiv  ·  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        doc.page.margins.left,
        y,
        { width: pageWidth * 0.7 },
      );
    doc.text(
      `Page ${i - pages.start + 1} of ${pages.count}`,
      doc.page.margins.left + pageWidth * 0.7,
      y,
      { width: pageWidth * 0.3, align: 'right' },
    );
  }
}

function drawSummaryTable(doc: InstanceType<typeof PDFDocument>, rooms: PdfRoom[]) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftX = doc.page.margins.left;

  doc.fontSize(13).fillColor(COLORS.primary).font('Helvetica-Bold')
    .text('Summary', leftX, doc.y);
  doc.moveDown(0.5);

  let grandTotal = 0;
  let totalItems = 0;
  let approvedItems = 0;

  for (const room of rooms) {
    for (const item of room.shortlistItems) {
      totalItems++;
      if (item.status === 'approved' || item.status === 'added_to_cart' || item.status === 'ordered') {
        approvedItems++;
        const price = getProductPrice(item.product);
        if (price != null) grandTotal += price * item.quantity;
      }
    }
  }

  const summaryData = [
    ['Total Rooms', String(rooms.length)],
    ['Total Products Shortlisted', String(totalItems)],
    ['Approved / In Cart / Ordered', String(approvedItems)],
    ['Estimated Total (approved items)', formatPrice(grandTotal)],
  ];

  for (const [label, value] of summaryData) {
    const rowY = doc.y;
    doc.fontSize(10).fillColor(COLORS.secondary).font('Helvetica')
      .text(label, leftX + 4, rowY, { width: pageWidth * 0.65 });
    doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text(value, leftX + pageWidth * 0.65, rowY, { width: pageWidth * 0.35, align: 'right' });
    doc.y = rowY + 16;
  }

  doc.moveDown(0.5);
  doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y)
    .strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.moveDown(1);
}

/* ─── Public API ─────────────────────────────────────── */

export function generateProjectPdf(data: ProjectPdfData): InstanceType<typeof PDFDocument> {
  const doc = createDoc();

  drawHeader(doc, data.designer);
  drawProjectInfo(doc, { project: data.project, client: data.client });

  // Summary first
  drawSummaryTable(doc, data.rooms);

  // Each room
  for (let i = 0; i < data.rooms.length; i++) {
    drawRoomSection(doc, data.rooms[i], i);
  }

  drawFooter(doc);
  doc.end();
  return doc;
}

export function generateRoomPdf(data: RoomPdfData): InstanceType<typeof PDFDocument> {
  const doc = createDoc();

  drawHeader(doc, data.designer);
  drawProjectInfo(doc, { project: data.project, client: data.client });

  // Single room
  drawRoomSection(doc, data.room, 0);

  drawFooter(doc);
  doc.end();
  return doc;
}
