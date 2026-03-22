# Admin Module — Detailed Plan

## What Exists Today

### Admin Backend (`/api/admin/*`, gated by `requireRole('admin')`)
- **GET /api/admin/me** — admin's own Designer record
- **GET /api/admin/stats** — `{ designers: { total, pending_review, approved, rejected, suspended }, totalProjects, totalOrders }`
- **GET /api/admin/designers** — filterable by `?status=` and `?search=`
- **GET /api/admin/designers/:id** — detail with `_count` + last 10 projects
- **PUT /api/admin/designers/:id/status** — approve/reject/suspend with audit log
- **GET /api/admin/activity** — last 50 AuditLog entries

### Admin Frontend
- `/admin/login` — public login page
- `/admin/dashboard` — 4 stat cards + pending applications table
- `/admin/designers` — filterable table (search + status)
- `/admin/designers/[id]` — designer detail + approve/reject/suspend

### Admin Sidebar Navigation
- Dashboard (active)
- Designers (active)
- **No Orders, Payments, or Analytics links**

---

## What Needs to Be Built

### Module 8A — Admin Orders

#### API Endpoints (add to `apps/api/src/routes/admin.ts`)

| Endpoint | Description |
|----------|-------------|
| **GET /api/admin/orders** | All orders platform-wide. Query params: `?status=`, `?designerId=`, `?search=` (project/client name), `?from=`, `?to=` (date range). Include: designer name, project name, client name, line item count, brand PO count, payment status. Paginated (page, limit). |
| **GET /api/admin/orders/:orderId** | Full order detail: line items (with product + room), brand POs, payments, audit trail (filtered by entityId=orderId or related). |
| **PUT /api/admin/orders/:orderId/status** | Admin force-update order status. Body: `{ status, reason? }`. Audit log: `admin_order_status_changed`. |

#### Frontend Pages

**`/admin/orders`** — Orders List
- Table columns: Order ID (8 chars), Designer, Project, Client, Status badge, Payment status, Total, Date, Actions (view)
- Filters: status tabs (All / Draft / Paid / Processing / Closed), search bar (project/client/designer name), date range picker
- Pagination (25 per page)
- Click row → navigate to detail

**`/admin/orders/[id]`** — Order Detail
- Header: Order ID, status badge, admin status change dropdown
- Meta section: designer name, project name, client name, date, total
- Payment section: payment status, Stripe payment intent ID, payment method, amount, timestamp
- Line items table: product image, name, brand, room, qty, unit price, line total
- Brand POs section: brand name, PO status (with admin-editable dropdown), subtotal, item count
- Audit trail: all audit log entries related to this order
- Actions: force-mark as paid, cancel order with reason

#### Admin Sidebar Update
- Add "Orders" nav item between "Designers" and any future links

---

### Module 8B — Admin Payments

#### API Endpoints

| Endpoint | Description |
|----------|-------------|
| **GET /api/admin/payments** | All payments platform-wide. Query params: `?status=` (pending/paid/failed/expired), `?from=`, `?to=`. Include: order ID, designer, project, amount, currency, payment method, Stripe IDs. Paginated. |
| **GET /api/admin/payments/:paymentId** | Single payment detail with full `stripeResponse` payload. |

#### Frontend Page

**`/admin/payments`** — Payments List
- Table: Payment ID, Order (link), Designer, Amount, Currency, Status badge, Method, Stripe Ref, Date
- Filters: status tabs (All / Pending / Paid / Failed / Expired), date range
- Highlight: pending payments older than 7 days in amber, failed in red
- Click → links to admin order detail

---

### Module 8C — Admin Dashboard Enhancements

#### API Changes

**Update GET /api/admin/stats** to include:
```
{
  designers: { total, pending_review, approved, rejected, suspended },
  totalProjects,
  orders: {
    total,
    draft (unpaid),
    paid,
    processing (split_to_brands),
    closed
  },
  revenue: {
    total (sum of paid order totalAmounts),
    thisMonth,
    averageOrderValue
  },
  payments: {
    total,
    pending,
    paid,
    failed
  }
}
```

#### Frontend Changes

**Update `/admin/dashboard`:**
- Expand stat cards grid: Designers, Projects, Orders, Revenue
- Add "Order Status" breakdown row (draft/paid/processing/closed counts)
- Add "Recent Orders" table (last 10 orders, all designers) with quick-view links
- Add "Payments Needing Attention" section: pending > 7 days, failed payments
- Add "Revenue This Month" highlight card

---

### Module 8D — Admin Brand PO Oversight

#### API Endpoint

| Endpoint | Description |
|----------|-------------|
| **GET /api/admin/brand-pos** | All brand POs platform-wide. Query params: `?status=`, `?brandName=`, `?from=`, `?to=`. Include: order ID, designer, brand, status, subtotal, item count. |
| **PUT /api/admin/brand-pos/:poId/status** | Admin force-update PO status with audit log. |

#### Frontend Page

**`/admin/brand-pos`** (optional, could be a tab on orders page)
- Table: Brand, Order (link), Designer, Status badge, Subtotal, Items, Created, Updated
- Group by brand view: expandable brand rows showing all POs
- Filters: brand name search, status, date range
- Highlight: POs in "sent" for > 14 days (not acknowledged)

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `apps/web/src/app/admin/(protected)/orders/page.tsx` | Admin orders list |
| `apps/web/src/app/admin/(protected)/orders/[id]/page.tsx` | Admin order detail |
| `apps/web/src/app/admin/(protected)/payments/page.tsx` | Admin payments list |

### Modified Files
| File | Changes |
|------|---------|
| `apps/api/src/routes/admin.ts` | Add orders, payments, brand PO endpoints + enhanced stats |
| `apps/web/src/lib/api.ts` | Add admin order/payment types + API methods |
| `apps/web/src/app/admin/(protected)/layout.tsx` | Add Orders + Payments sidebar links |
| `apps/web/src/app/admin/(protected)/dashboard/page.tsx` | Enhanced stats + recent orders + payment alerts |

---

## Build Order

| Phase | Tasks | Effort |
|-------|-------|--------|
| **Phase 1** | Admin orders API (list + detail + status update) | Backend |
| **Phase 2** | Admin orders list page + order detail page | Frontend |
| **Phase 3** | Admin payments API + payments list page | Backend + Frontend |
| **Phase 4** | Dashboard enhancements (expanded stats, recent orders, payment alerts) | Both |
| **Phase 5** | Brand PO oversight (optional, if needed) | Both |

**Recommended:** Build Phase 1 + 2 first — this gives immediate admin visibility into all orders. Phase 3–5 can follow incrementally.

---

## Types to Add (`apps/web/src/lib/api.ts`)

```typescript
// Admin Orders
interface AdminOrderSummary {
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

interface AdminOrderDetail extends AdminOrderSummary {
  taxAmount: number | null;
  updatedAt: string;
  lineItems: OrderLineItem[];
  brandPOs: BrandPO[];
  payments: Payment[];
}

// Admin Payments
interface AdminPayment {
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
    id: string;
    status: string;
    designer: { fullName: string };
    project: { name: string };
  };
}

// Enhanced Admin Stats
interface AdminStatsEnhanced {
  designers: { total: number; pending_review: number; approved: number; rejected: number; suspended: number };
  totalProjects: number;
  orders: { total: number; draft: number; paid: number; processing: number; closed: number };
  revenue: { total: number; thisMonth: number; averageOrderValue: number };
  payments: { total: number; pending: number; paid: number; failed: number };
}
```

## API Methods to Add

```typescript
// Admin Orders
getAdminOrders(params?: { status?: string; search?: string; designerId?: string; page?: number; limit?: number })
getAdminOrder(orderId: string)
updateAdminOrderStatus(orderId: string, status: string, reason?: string)

// Admin Payments
getAdminPayments(params?: { status?: string; page?: number; limit?: number })

// Admin Brand POs
getAdminBrandPos(params?: { status?: string; brandName?: string })
updateAdminBrandPoStatus(poId: string, status: string)
```

---

## Verification Checklist

- [ ] Admin can see all orders across all designers
- [ ] Admin can filter orders by status, search, date
- [ ] Admin can view full order detail with line items, brand POs, payments
- [ ] Admin can force-change order status
- [ ] Admin can see all payments with status filtering
- [ ] Dashboard shows order counts, revenue, and payment health
- [ ] All admin actions are audit-logged
- [ ] Sidebar shows Orders + Payments links
