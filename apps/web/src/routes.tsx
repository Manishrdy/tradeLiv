import { Navigate, type RouteObject } from 'react-router-dom';

import RootLayout from './app/RootLayout';
import RouteError from './components/RouteError';
import NotFound from './app/not-found';
import HomePage from './app/HomePage';

// Public marketing pages
import About from './app/about/page';
import Contact from './app/contact/page';
import Terms from './app/terms/page';
import Privacy from './app/privacy/page';

// Auth (public)
import AuthLayout from './app/(auth)/layout';
import Login from './app/(auth)/login/page';
import Signup from './app/(auth)/signup/page';
import VerifyEmail from './app/(auth)/verify-email/page';
import Impersonate from './app/(auth)/impersonate/page';
import AdminLogin from './app/admin/login/page';

// Designer app
import DesignerLayout from './app/(designer)/layout';
import Dashboard from './app/(designer)/dashboard/page';
import Clients from './app/(designer)/clients/page';
import NewClient from './app/(designer)/clients/new/page';
import ClientDetail from './app/(designer)/clients/[id]/page';
import Catalog from './app/(designer)/catalog/page';
import NewCatalog from './app/(designer)/catalog/new/page';
import CatalogDetail from './app/(designer)/catalog/[id]/page';
import Compare from './app/(designer)/compare/page';
import Orders from './app/(designer)/orders/page';
import Settings from './app/(designer)/settings/page';
import Projects from './app/(designer)/projects/page';
import NewProject from './app/(designer)/projects/new/page';
import ProjectLayout from './app/(designer)/projects/[id]/layout';
import ProjectOverview from './app/(designer)/projects/[id]/page';
import Cart from './app/(designer)/projects/[id]/cart/page';
import Rooms from './app/(designer)/projects/[id]/rooms/page';
import RoomDetail from './app/(designer)/projects/[id]/rooms/[roomId]/page';
import Quotes from './app/(designer)/projects/[id]/quotes/page';
import QuoteDetail from './app/(designer)/projects/[id]/quotes/[quoteId]/page';
import ProjectOrders from './app/(designer)/projects/[id]/orders/page';
import OrderDetail from './app/(designer)/projects/[id]/orders/[orderId]/page';
import OrderTracking from './app/(designer)/projects/[id]/orders/[orderId]/tracking/page';

// Admin app
import AdminLayout from './app/admin/(protected)/layout';
import AdminDashboard from './app/admin/(protected)/dashboard/page';
import AdminDesigners from './app/admin/(protected)/designers/page';
import AdminDesignerDetail from './app/admin/(protected)/designers/[id]/page';
import AdminPayments from './app/admin/(protected)/payments/page';
import AdminFurnitureCategories from './app/admin/(protected)/furniture-categories/page';
import AdminIssues from './app/admin/(protected)/issues/page';
import AdminTeam from './app/admin/(protected)/team/page';
import AdminAnalytics from './app/admin/(protected)/analytics/page';
import AdminTimeTracking from './app/admin/(protected)/time-tracking/page';
import AdminHealth from './app/admin/(protected)/health/page';
import AdminConfig from './app/admin/(protected)/config/page';
import AdminBackups from './app/admin/(protected)/backups/page';

// Client portal (public, token)
import PortalLayout from './app/client/p/[portalToken]/layout';
import Portal from './app/client/p/[portalToken]/page';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <About /> },
      { path: 'contact', element: <Contact /> },
      { path: 'terms', element: <Terms /> },
      { path: 'privacy', element: <Privacy /> },

      // ── Auth (public) ──
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <Login /> },
          { path: 'signup', element: <Signup /> },
          { path: 'verify-email', element: <VerifyEmail /> },
          { path: 'impersonate', element: <Impersonate /> },
        ],
      },
      { path: 'admin/login', element: <AdminLogin /> },

      // ── Designer app (layout self-gates via api.getMe) ──
      {
        element: <DesignerLayout />,
        children: [
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'clients', element: <Clients /> },
          { path: 'clients/new', element: <NewClient /> },
          { path: 'clients/:id', element: <ClientDetail /> },
          { path: 'catalog', element: <Catalog /> },
          { path: 'catalog/new', element: <NewCatalog /> },
          { path: 'catalog/:id', element: <CatalogDetail /> },
          { path: 'compare', element: <Compare /> },
          { path: 'orders', element: <Orders /> },
          { path: 'settings', element: <Settings /> },
          { path: 'projects', element: <Projects /> },
          { path: 'projects/new', element: <NewProject /> },
          {
            path: 'projects/:id',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <ProjectOverview /> },
              { path: 'cart', element: <Cart /> },
              { path: 'rooms', element: <Rooms /> },
              { path: 'rooms/:roomId', element: <RoomDetail /> },
              { path: 'quotes', element: <Quotes /> },
              { path: 'quotes/:quoteId', element: <QuoteDetail /> },
              { path: 'orders', element: <ProjectOrders /> },
              { path: 'orders/:orderId', element: <OrderDetail /> },
              { path: 'orders/:orderId/tracking', element: <OrderTracking /> },
            ],
          },
        ],
      },

      // ── Admin app (layout self-gates via api.getAdminMe) ──
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboard /> },
          { path: 'designers', element: <AdminDesigners /> },
          { path: 'designers/:id', element: <AdminDesignerDetail /> },
          { path: 'payments', element: <AdminPayments /> },
          { path: 'furniture-categories', element: <AdminFurnitureCategories /> },
          { path: 'issues', element: <AdminIssues /> },
          { path: 'team', element: <AdminTeam /> },
          { path: 'analytics', element: <AdminAnalytics /> },
          { path: 'time-tracking', element: <AdminTimeTracking /> },
          { path: 'health', element: <AdminHealth /> },
          { path: 'config', element: <AdminConfig /> },
          { path: 'backups', element: <AdminBackups /> },
        ],
      },

      // ── Client portal (public, token) ──
      {
        path: 'client/p/:portalToken',
        element: <PortalLayout />,
        children: [{ index: true, element: <Portal /> }],
      },

      // ── 404 ──
      { path: '*', element: <NotFound /> },
    ],
  },
];
