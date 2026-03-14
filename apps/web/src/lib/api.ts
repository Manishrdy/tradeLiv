const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ApiResponse<T> = { data: T; error?: never } | { data?: never; error: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include', // always send session cookie
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const body = await res.json();

    if (!res.ok) {
      return { error: body.error || body.message || 'Something went wrong' };
    }

    return { data: body };
  } catch {
    return { error: 'Unable to connect to the server. Please try again.' };
  }
}

/* ─── Payload & response types ─────────────────────── */

export interface SignupDesignerPayload {
  fullName: string;
  email: string;
  password: string;
  businessName?: string;
  phone?: string;
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
  role: 'designer';
  user: AuthUser;
}

export interface DesignerProfile {
  id: string;
  fullName: string;
  email: string;
  businessName?: string;
  phone?: string;
  status: string;
  createdAt: string;
}

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

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
}

export interface PortalShortlistItem {
  id: string;
  status: 'suggested' | 'approved' | 'rejected' | 'added_to_cart';
  selectedVariant: Record<string, unknown> | null;
  sharedNotes: string | null;
  clientNotes: string | null;
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

export interface ClientPayload {
  name: string;
  email?: string;
  phone?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
}

/* ─── API methods ───────────────────────────────────── */

export const api = {
  // Auth
  signupDesigner: (payload: SignupDesignerPayload) =>
    request<AuthResponse>('/api/auth/signup/designer', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  getMe: () =>
    request<DesignerProfile>('/api/auth/me'),

  // Clients
  getClients: () =>
    request<Client[]>('/api/clients'),

  createClient: (payload: ClientPayload) =>
    request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(payload) }),

  getClient: (id: string) =>
    request<ClientDetail>(`/api/clients/${id}`),

  updateClient: (id: string, payload: ClientPayload) =>
    request<Client>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Portal (public — no auth required)
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
};
