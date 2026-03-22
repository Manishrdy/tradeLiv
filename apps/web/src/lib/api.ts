const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ApiResponse<T> = { data: T; error?: never } | { data?: never; error: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    let body: Record<string, unknown> = {};
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      const text = await res.text();
      if (text) body = { message: text };
    }

    if (!res.ok) {
      return { error: (body.error as string) || (body.message as string) || `Request failed (${res.status})` };
    }

    return { data: body as T };
  } catch {
    return { error: 'Unable to connect to the server. Please try again.' };
  }
}

/* ─── Auth types ────────────────────────────────────── */

export interface SignupDesignerPayload {
  fullName: string;
  email: string;
  password: string;
  businessName?: string;
  phone?: string;
}

export interface SignupResponse {
  role: string;
  user: { id: string; fullName: string; email: string; status: string };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  fullName?: string;
  email: string;
  status?: string;
}

export interface AuthResponse {
  role: 'designer' | 'admin';
  user: AuthUser;
}

export interface DesignerProfile {
  id: string;
  fullName: string;
  email: string;
  businessName?: string;
  phone?: string;
  status: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface ProfileUpdatePayload {
  fullName?: string;
  businessName?: string | null;
  phone?: string | null;
}

/* ─── Shared types ──────────────────────────────────── */

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

/* ─── Client types ──────────────────────────────────── */

export interface Client {
  id: string;
  designerId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  billingAddress?: Address | null;
  shippingAddress?: Address | null;
  createdAt: string;
  _count?: { projects: number };
}

export interface ClientDetail extends Client {
  projects: { id: string; name: string; status: string; portalToken: string | null; createdAt: string }[];
}

export interface ClientPayload {
  name: string;
  email?: string;
  phone?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
}

/* ─── Project + Room types ──────────────────────────── */

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  portalToken: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; email: string | null };
  _count: { rooms: number; shortlistItems: number; orders: number };
}

export interface RoomRequirements {
  colorPalette?: string;
  materialPreferences?: string;
  seatingCapacity?: number;
  functionalConstraints?: string;
  inspirationLinks?: string[];
}

export interface Room {
  id: string;
  projectId: string;
  name: string;
  lengthFt: number | null;
  widthFt: number | null;
  heightFt: number | null;
  areaSqft: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  categoryNeeds: string[];
  clientRequirements: RoomRequirements | null;
  notes: string | null;
  createdAt: string;
  _count?: { shortlistItems: number };
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  stylePreference: string | null;
  portalToken: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string; name: string; email: string | null; phone: string | null;
    billingAddress: Address | null; shippingAddress: Address | null;
  };
  rooms: Room[];
  _count: { shortlistItems: number; cartItems: number; orders: number };
}

export interface ProjectPayload {
  clientId: string;
  name: string;
  description?: string;
  budgetMin?: number;
  budgetMax?: number;
  stylePreference?: string;
  status?: 'draft' | 'active';
}

export interface ProjectUpdatePayload {
  name?: string;
  description?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  stylePreference?: string | null;
  status?: 'draft' | 'active' | 'ordered' | 'closed';
}

export interface RoomPayload {
  name: string;
  lengthFt?: number;
  widthFt?: number;
  heightFt?: number;
  budgetMin?: number;
  budgetMax?: number;
  categoryNeeds?: string[];
  clientRequirements?: RoomRequirements;
  notes?: string;
}

export interface DashboardStats {
  activeProjects: number;
  totalClients: number;
  totalShortlisted: number;
  totalOrders: number;
}

export interface AuditLogEntry {
  id: string;
  actorType: 'designer' | 'client' | 'admin' | 'system';
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

/* ─── Product / Catalog types ──────────────────────── */

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  unit?: 'cm' | 'in' | 'ft';
  raw?: string;
}

export interface ProductMetadata {
  description?: string;
  keyFeatures?: string[];
  assembly?: string;
  careInstructions?: string;
  warranty?: string;
  weightCapacity?: string;
  style?: string;
  collection?: string;
  sku?: string;
  availableColors?: string[];
  availableSizes?: string[];
  seatHeight?: string;
  armHeight?: string;
  seatDepth?: string;
  legMaterial?: string;
  cushionType?: string;
  fabricType?: string;
  [key: string]: unknown;
}

export interface Product {
  id: string;
  designerId: string;
  productName: string;
  sourceUrl: string;
  brandName: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  dimensions: ProductDimensions | null;
  material: string | null;
  finishes: string[];
  leadTime: string | null;
  category: string | null;
  metadata: ProductMetadata | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { shortlistItems: number; cartItems: number };
}

export interface ProductListItem {
  id: string;
  productName: string;
  brandName: string | null;
  price: number | null;
  imageUrl: string | null;
  category: string | null;
  isActive: boolean;
  sourceUrl: string;
  material: string | null;
  finishes: string[];
  leadTime: string | null;
  createdAt: string;
  _count: { shortlistItems: number };
}

export interface ProductsResponse {
  products: ProductListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductPayload {
  productName: string;
  sourceUrl: string;
  brandName?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  productUrl?: string;
  dimensions?: ProductDimensions;
  material?: string;
  finishes?: string[];
  leadTime?: string;
  category?: string;
  metadata?: ProductMetadata;
}

export interface ExtractedProduct {
  productName: string;
  brandName?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  productUrl?: string;
  dimensions?: ProductDimensions;
  material?: string;
  finishes?: string[];
  leadTime?: string;
  category?: string;
  metadata?: ProductMetadata;
}

export interface DuplicateProduct {
  id: string;
  productName: string;
  brandName: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ExtractionResult {
  type: 'single' | 'multiple' | 'duplicate';
  product?: ExtractedProduct;
  products?: ExtractedProduct[];
  totalFound?: number;
  duplicateProduct?: DuplicateProduct;
}

export interface BatchExtractionResultItem {
  url: string;
  type: 'single' | 'duplicate' | 'error';
  product?: ExtractedProduct;
  duplicateProduct?: DuplicateProduct;
  error?: string;
}

export interface BatchExtractionResult {
  results: BatchExtractionResultItem[];
}

export interface ProductUpdatePayload {
  productName?: string;
  sourceUrl?: string;
  brandName?: string | null;
  price?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  dimensions?: ProductDimensions | null;
  material?: string | null;
  finishes?: string[];
  leadTime?: string | null;
  category?: string | null;
  metadata?: ProductMetadata | null;
}

/* ─── Shortlist types ──────────────────────────────── */

export interface ShortlistProduct {
  id: string;
  productName: string;
  brandName: string | null;
  price: number | null;
  imageUrl: string | null;
  category: string | null;
  material: string | null;
  dimensions: ProductDimensions | null;
  finishes: string[];
  leadTime: string | null;
  productUrl: string | null;
  metadata: {
    description?: string;
    keyFeatures?: string[];
    assembly?: string;
    careInstructions?: string;
    warranty?: string;
    weightCapacity?: string;
    style?: string;
    collection?: string;
    [key: string]: unknown;
  } | null;
  isActive?: boolean;
}

export interface ShortlistItem {
  id: string;
  projectId: string;
  roomId: string;
  productId: string;
  designerId: string;
  selectedVariant: Record<string, string> | null;
  quantity: number;
  status: 'suggested' | 'approved' | 'rejected' | 'added_to_cart';
  designerNotes: string | null;
  clientNotes: string | null;
  sharedNotes: string | null;
  fitAssessment: string | null;
  priorityRank: number | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  product: ShortlistProduct;
  room?: { id: string; name: string };
}

export interface ShortlistAddPayload {
  productId: string;
  roomId: string;
  quantity?: number;
  selectedVariant?: Record<string, string>;
  designerNotes?: string;
  sharedNotes?: string;
  fitAssessment?: string;
}

export interface ShortlistUpdatePayload {
  quantity?: number;
  selectedVariant?: Record<string, string> | null;
  designerNotes?: string | null;
  sharedNotes?: string | null;
  fitAssessment?: string | null;
  priorityRank?: number | null;
  isPinned?: boolean;
  status?: 'suggested' | 'approved' | 'rejected' | 'added_to_cart';
}

/* ─── Cart types ───────────────────────────────────── */

export interface CartItem {
  id: string;
  projectId: string;
  productId: string;
  roomId: string;
  selectedVariant: Record<string, string> | null;
  quantity: number;
  unitPrice: number | null;
  createdAt: string;
  product: ShortlistProduct;
  room: { id: string; name: string };
}

export interface CartAddPayload {
  shortlistItemId: string;
  quantity?: number;
}

/* ─── Order types ──────────────────────────────────── */

export interface OrderLineItem {
  id: string;
  orderId: string;
  productId: string;
  roomId: string;
  selectedVariant: Record<string, string> | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  product: { id: string; productName: string; brandName: string | null; price: number | null; imageUrl: string | null; category: string | null };
  room: { id: string; name: string };
}

export interface BrandPO {
  id: string;
  orderId: string;
  brandName: string;
  status: string;
  subtotal: number | null;
  createdAt: string;
  lineItems: OrderLineItem[];
}

export interface OrderSummary {
  id: string;
  projectId: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  _count: { lineItems: number; brandPOs: number };
}

export interface OrderDetail {
  id: string;
  projectId: string;
  designerId: string;
  status: string;
  totalAmount: number | null;
  taxAmount: number | null;
  createdAt: string;
  updatedAt: string;
  lineItems: OrderLineItem[];
  brandPOs: BrandPO[];
}

export interface OrderSummaryGlobal extends OrderSummary {
  project: { id: string; name: string; client: { name: string } | null };
}

export interface Payment {
  id: string;
  orderId: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
}

/* ─── Portal types ──────────────────────────────────── */

export interface PortalProduct {
  id: string;
  productName: string;
  brandName: string | null;
  price: number | null;
  imageUrl: string | null;
  productUrl: string | null;
  dimensions: Record<string, unknown> | null;
  material: string | null;
  finishes?: string[];
  leadTime?: string | null;
  category?: string | null;
  metadata?: {
    description?: string;
    keyFeatures?: string[];
    assembly?: string;
    careInstructions?: string;
    warranty?: string;
    style?: string;
    [key: string]: unknown;
  } | null;
}

export interface PortalShortlistItem {
  id: string;
  status: 'suggested' | 'approved' | 'rejected' | 'added_to_cart';
  quantity: number;
  selectedVariant: Record<string, unknown> | null;
  sharedNotes: string | null;
  clientNotes: string | null;
  fitAssessment: string | null;
  isPinned: boolean;
  product: PortalProduct;
}

export interface PortalRoom {
  id: string;
  name: string;
  areaSqft: number | null;
  lengthFt: number | null;
  widthFt: number | null;
  shortlistItems: PortalShortlistItem[];
}

export interface PortalOrder {
  id: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
}

export interface PortalProject {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  designer: { fullName: string; businessName: string | null; phone: string | null; email: string };
  client: { name: string; shippingAddress: Record<string, unknown> | null };
  rooms: PortalRoom[];
  orders: PortalOrder[];
}

/* ─── Admin types ───────────────────────────────────── */

export interface AdminStats {
  designers: {
    total: number;
    pending_review: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
  totalProjects: number;
  totalOrders: number;
}

export interface AdminEnhancedStats {
  designers: { total: number; pending_review: number; approved: number; rejected: number; suspended: number };
  totalProjects: number;
  orders: { total: number; draft: number; paid: number; processing: number; closed: number };
  revenue: { total: number; thisMonth: number; averageOrderValue: number };
  payments: { total: number; pending: number; paid: number; failed: number };
  recentOrders: {
    id: string; status: string; totalAmount: number | null; createdAt: string;
    designer: { fullName: string };
    project: { name: string; client: { name: string } | null };
  }[];
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  businessName: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface AdminOrderSummary {
  id: string;
  projectId: string;
  designerId: string;
  status: string;
  totalAmount: number | null;
  stripePaymentId: string | null;
  createdAt: string;
  designer: { id: string; fullName: string; email: string };
  project: { id: string; name: string; client: { name: string } | null };
  _count: { lineItems: number; brandPOs: number; payments: number };
}

export interface AdminOrderDetail extends AdminOrderSummary {
  taxAmount: number | null;
  updatedAt: string;
  lineItems: {
    id: string; quantity: number; unitPrice: number | null; lineTotal: number | null;
    product: { id: string; productName: string; brandName: string | null; imageUrl: string | null; price: number | null };
    room: { id: string; name: string };
  }[];
  brandPOs: {
    id: string; brandName: string; status: string; subtotal: number | null;
    lineItems: { id: string; quantity: number; unitPrice: number | null; lineTotal: number | null }[];
  }[];
  payments: {
    id: string; stripeSessionId: string | null; stripePaymentIntentId: string | null;
    amount: number; currency: string; status: string; paymentMethod: string | null; createdAt: string;
  }[];
  auditLogs: AuditLogEntry[];
}

export interface AdminPayment {
  id: string;
  orderId: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  order: {
    id: string; status: string;
    designer: { fullName: string };
    project: { name: string };
  };
}

export interface AdminBrandPO {
  id: string;
  orderId: string;
  brandName: string;
  status: string;
  subtotal: number | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    designer: { fullName: string };
    project: { name: string };
  };
  _count: { lineItems: number };
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  totalPages: number;
  [key: string]: T[] | number;
}

export interface AdminDesigner {
  id: string;
  fullName: string;
  email: string;
  businessName: string | null;
  phone: string | null;
  status: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { clients: number; projects: number; orders: number };
}

export interface AdminDesignerDetail extends AdminDesigner {
  updatedAt: string;
  projects: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    client: { name: string };
    _count: { rooms: number; shortlistItems: number };
  }[];
}

/* ─── API methods ───────────────────────────────────── */

export const api = {
  // Auth
  signupDesigner: (payload: SignupDesignerPayload) =>
    request<SignupResponse>('/api/auth/signup/designer', { method: 'POST', body: JSON.stringify(payload) }),

  login: (payload: LoginPayload) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  adminLogin: (payload: LoginPayload) =>
    request<AuthResponse>('/api/auth/admin/login', { method: 'POST', body: JSON.stringify(payload) }),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  getMe: () =>
    request<DesignerProfile>('/api/auth/me'),

  updateProfile: (payload: ProfileUpdatePayload) =>
    request<DesignerProfile>('/api/auth/me', { method: 'PUT', body: JSON.stringify(payload) }),

  // Clients
  getClients: () =>
    request<Client[]>('/api/clients'),

  createClient: (payload: ClientPayload) =>
    request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(payload) }),

  getClient: (id: string) =>
    request<ClientDetail>(`/api/clients/${id}`),

  updateClient: (id: string, payload: ClientPayload) =>
    request<Client>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteClient: (id: string) =>
    request<{ message: string }>(`/api/clients/${id}`, { method: 'DELETE' }),

  // Projects
  getDashboardStats: () =>
    request<DashboardStats>('/api/projects/stats'),

  getProjects: (status?: string) =>
    request<ProjectSummary[]>(`/api/projects${status ? `?status=${status}` : ''}`),

  createProject: (payload: ProjectPayload) =>
    request<ProjectDetail>('/api/projects', { method: 'POST', body: JSON.stringify(payload) }),

  getProject: (id: string) =>
    request<ProjectDetail>(`/api/projects/${id}`),

  updateProject: (id: string, payload: ProjectUpdatePayload) =>
    request<ProjectDetail>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  generatePortalToken: (id: string) =>
    request<{ portalToken: string }>(`/api/projects/${id}/generate-token`, { method: 'POST' }),

  getProjectActivity: (id: string) =>
    request<AuditLogEntry[]>(`/api/projects/${id}/activity`),

  // Rooms
  createRoom: (projectId: string, payload: RoomPayload) =>
    request<Room>(`/api/projects/${projectId}/rooms`, { method: 'POST', body: JSON.stringify(payload) }),

  updateRoom: (projectId: string, roomId: string, payload: RoomPayload) =>
    request<Room>(`/api/projects/${projectId}/rooms/${roomId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteRoom: (projectId: string, roomId: string) =>
    request<{ message: string }>(`/api/projects/${projectId}/rooms/${roomId}`, { method: 'DELETE' }),

  // Catalog
  getProducts: (params?: { search?: string; category?: string; page?: number; limit?: number; includeInactive?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.includeInactive) qs.set('includeInactive', 'true');
    const q = qs.toString();
    return request<ProductsResponse>(`/api/catalog/products${q ? `?${q}` : ''}`);
  },

  getProductCategories: () =>
    request<string[]>('/api/catalog/products/categories'),

  getProduct: (id: string) =>
    request<Product>(`/api/catalog/products/${id}`),

  createProduct: (payload: ProductPayload) =>
    request<Product>('/api/catalog/products', { method: 'POST', body: JSON.stringify(payload) }),

  updateProduct: (id: string, payload: ProductUpdatePayload) =>
    request<Product>(`/api/catalog/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deactivateProduct: (id: string) =>
    request<Product>(`/api/catalog/products/${id}/deactivate`, { method: 'PUT' }),

  reactivateProduct: (id: string) =>
    request<Product>(`/api/catalog/products/${id}/reactivate`, { method: 'PUT' }),

  deleteProduct: (id: string) =>
    request<{ message: string }>(`/api/catalog/products/${id}`, { method: 'DELETE' }),

  extractProduct: (sourceUrl: string, reextract?: boolean) =>
    request<ExtractionResult>('/api/catalog/extract', { method: 'POST', body: JSON.stringify({ sourceUrl, reextract }) }),

  extractProductsBatch: (urls: string[]) =>
    request<BatchExtractionResult>('/api/catalog/extract/batch', { method: 'POST', body: JSON.stringify({ urls }) }),

  // Shortlist
  getProjectShortlist: (projectId: string, roomId?: string) => {
    const qs = roomId ? `?roomId=${roomId}` : '';
    return request<ShortlistItem[]>(`/api/orders/projects/${projectId}/shortlist${qs}`);
  },

  addToShortlist: (projectId: string, payload: ShortlistAddPayload) =>
    request<ShortlistItem>(`/api/orders/projects/${projectId}/shortlist`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateShortlistItem: (projectId: string, itemId: string, payload: ShortlistUpdatePayload) =>
    request<ShortlistItem>(`/api/orders/projects/${projectId}/shortlist/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  removeShortlistItem: (projectId: string, itemId: string) =>
    request<{ message: string }>(`/api/orders/projects/${projectId}/shortlist/${itemId}`, {
      method: 'DELETE',
    }),

  // Cart
  getCart: (projectId: string) =>
    request<CartItem[]>(`/api/orders/projects/${projectId}/cart`),

  addToCart: (projectId: string, payload: CartAddPayload) =>
    request<CartItem>(`/api/orders/projects/${projectId}/cart`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCartItem: (projectId: string, itemId: string, payload: { quantity: number }) =>
    request<CartItem>(`/api/orders/projects/${projectId}/cart/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  removeCartItem: (projectId: string, itemId: string) =>
    request<{ message: string }>(`/api/orders/projects/${projectId}/cart/${itemId}`, {
      method: 'DELETE',
    }),

  // Orders
  getAllOrders: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return request<OrderSummaryGlobal[]>(`/api/orders${qs}`);
  },

  getProjectOrders: (projectId: string) =>
    request<OrderSummary[]>(`/api/orders/projects/${projectId}/orders`),

  createOrder: (projectId: string) =>
    request<OrderDetail>(`/api/orders/projects/${projectId}/orders`, {
      method: 'POST',
    }),

  getOrder: (projectId: string, orderId: string) =>
    request<OrderDetail>(`/api/orders/projects/${projectId}/orders/${orderId}`),

  cancelOrder: (projectId: string, orderId: string) =>
    request<{ message: string }>(`/api/orders/projects/${projectId}/orders/${orderId}/cancel`, {
      method: 'PUT',
    }),

  updateBrandPoStatus: (orderId: string, poId: string, status: string) =>
    request<BrandPO>(`/api/orders/${orderId}/brand-pos/${poId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Payments
  createCheckoutSession: (orderId: string) =>
    request<{ sessionUrl: string }>('/api/payments/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }),

  getOrderPayments: (orderId: string) =>
    request<Payment[]>(`/api/payments/order/${orderId}`),

  // Portal (public)
  getPortalProject: (portalToken: string) =>
    request<PortalProject>(`/api/portal/${portalToken}`),

  updatePortalShortlistItem: (
    portalToken: string,
    itemId: string,
    payload: { clientNotes?: string; status?: 'suggested' | 'approved' | 'rejected' },
  ) =>
    request<PortalShortlistItem>(`/api/portal/${portalToken}/shortlist/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Admin
  getAdminMe: () =>
    request<{ id: string; fullName: string; email: string; isAdmin: boolean; isSuperAdmin: boolean }>('/api/admin/me'),

  getAdminStats: () =>
    request<AdminStats>('/api/admin/stats'),

  getAdminDesigners: (params?: { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<AdminDesigner[]>(`/api/admin/designers${q ? `?${q}` : ''}`);
  },

  getAdminDesigner: (id: string) =>
    request<AdminDesignerDetail>(`/api/admin/designers/${id}`),

  updateDesignerStatus: (id: string, status: string) =>
    request<AdminDesigner>(`/api/admin/designers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  getAdminActivity: () =>
    request<AuditLogEntry[]>('/api/admin/activity'),

  // Admin team management
  getAdminAdmins: () =>
    request<AdminUser[]>('/api/admin/admins'),

  createAdmin: (payload: { designerId?: string; email?: string; password?: string; fullName?: string }) =>
    request<AdminUser>('/api/admin/admins', { method: 'POST', body: JSON.stringify(payload) }),

  removeAdmin: (id: string) =>
    request<{ message: string }>(`/api/admin/admins/${id}`, { method: 'DELETE' }),

  // Admin orders
  getAdminOrders: (params?: { status?: string; search?: string; designerId?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.designerId) qs.set('designerId', params.designerId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<{ orders: AdminOrderSummary[]; total: number; page: number; totalPages: number }>(`/api/admin/orders${q ? `?${q}` : ''}`);
  },

  getAdminOrder: (orderId: string) =>
    request<AdminOrderDetail>(`/api/admin/orders/${orderId}`),

  updateAdminOrderStatus: (orderId: string, status: string, reason?: string) =>
    request(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    }),

  // Admin payments
  getAdminPayments: (params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<{ payments: AdminPayment[]; total: number; page: number; totalPages: number }>(`/api/admin/payments${q ? `?${q}` : ''}`);
  },

  getAdminPayment: (paymentId: string) =>
    request<AdminPayment>(`/api/admin/payments/${paymentId}`),

  // Admin brand POs
  getAdminBrandPos: (params?: { status?: string; brandName?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.brandName) qs.set('brandName', params.brandName);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<{ brandPOs: AdminBrandPO[]; total: number; page: number; totalPages: number }>(`/api/admin/brand-pos${q ? `?${q}` : ''}`);
  },

  updateAdminBrandPoStatus: (poId: string, status: string) =>
    request(`/api/admin/brand-pos/${poId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Admin enhanced stats
  getAdminEnhancedStats: () =>
    request<AdminEnhancedStats>('/api/admin/enhanced-stats'),
};
