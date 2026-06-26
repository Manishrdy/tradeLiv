import { Outlet } from 'react-router-dom';

/** Top-level layout: hosts the route error boundary and renders matched routes. */
export default function RootLayout() {
  return <Outlet />;
}
