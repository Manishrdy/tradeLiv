export type DesignerStatus = 'pending_review' | 'approved' | 'rejected' | 'suspended';
export type ProjectStatus = 'draft' | 'active' | 'ordered' | 'closed';
export type ShortlistStatus = 'suggested' | 'approved' | 'rejected' | 'added_to_cart' | 'ordered';
export type OrderStatus = 'draft' | 'submitted' | 'paid' | 'split_to_brands' | 'closed';
export type BrandPOStatus = 'sent' | 'acknowledged' | 'in_production' | 'dispatched' | 'delivered' | 'cancelled';

export interface Designer {
  id: string;
  email: string;
  fullName: string;
  businessName?: string;
  phone?: string;
  status: DesignerStatus;
  createdAt: string;
}

export interface Client {
  id: string;
  designerId: string;
  name: string;
  email?: string;
  phone?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  accessCode?: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Project {
  id: string;
  designerId: string;
  clientId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  budgetMin?: number;
  budgetMax?: number;
  stylePreference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  projectId: string;
  name: string;
  lengthFt?: number;
  widthFt?: number;
  heightFt?: number;
  areaSqft?: number;
  categoryNeeds: string[];
  budgetMin?: number;
  budgetMax?: number;
  clientRequirements?: RoomRequirements;
  notes?: string;
}

export interface RoomRequirements {
  colorPalette?: string;
  materialPreferences?: string;
  seatingCapacity?: number;
  functionalConstraints?: string;
  inspirationLinks?: string[];
  budgetPriority?: string;
}

export interface Product {
  id: string;
  sourceUrl: string;
  productName: string;
  brandName?: string;
  price?: number;
  imageUrl?: string;
  productUrl?: string;
  dimensions?: ProductDimensions;
  material?: string;
  finishes: string[];
  leadTime?: string;
  metadata?: Record<string, unknown>;
  category?: string;
  isActive: boolean;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  unit?: 'cm' | 'in' | 'ft';
}

export interface ShortlistItem {
  id: string;
  projectId: string;
  roomId: string;
  productId: string;
  designerId: string;
  selectedVariant?: Record<string, string>;
  quantity: number;
  status: ShortlistStatus;
  designerNotes?: string;
  clientNotes?: string;
  sharedNotes?: string;
  fitAssessment?: string;
  priorityRank?: number;
  isPinned: boolean;
}

export interface Order {
  id: string;
  projectId: string;
  designerId: string;
  status: OrderStatus;
  totalAmount?: number;
  taxAmount?: number;
  stripePaymentId?: string;
  createdAt: string;
}

export interface BrandPurchaseOrder {
  id: string;
  orderId: string;
  brandName: string;
  status: BrandPOStatus;
  subtotal?: number;
}
