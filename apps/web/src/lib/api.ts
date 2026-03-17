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
  pending: boolean;
  message: string;
  user: { id: string; fullName: string; email: string };
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
}

export interface Product {
  id: string;
  designerId: string;
  productName: string;
  sourceUrl: string;
  brandName: string | null;
  price: number | null;
  imageUrl: string | null;
  productUrl: string | null;
  dimensions: ProductDimensions | null;
  material: string | null;
  finishes: string[];
  leadTime: string | null;
  category: string | null;
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
  imageUrl?: string;
  productUrl?: string;
  dimensions?: ProductDimensions;
  material?: string;
  finishes?: string[];
  leadTime?: string;
  category?: string;
}

export interface ProductUpdatePayload {
  productName?: string;
  sourceUrl?: string;
  brandName?: string | null;
  price?: number | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  dimensions?: ProductDimensions | null;
  material?: string | null;
  finishes?: string[];
  leadTime?: string | null;
  category?: string | null;
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
}

export interface PortalShortlistItem {
  id: string;
  status: 'suggested' | 'approved' | 'rejected' | 'added_to_cart';
  quantity: number;
  selectedVariant: Record<string, unknown> | null;
  sharedNotes: string | null;
  clientNotes: string | null;
  fitAssessment: string | null;
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
    request<{ id: string; fullName: string; email: string; isAdmin: boolean }>('/api/admin/me'),

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
};
