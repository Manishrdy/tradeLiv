import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store/auth';
import LandingV2 from './landing-v2/LandingV2';

/**
 * Landing route. Replaces the old server component that read the session cookie.
 * Renders the marketing page (prerendered for SEO); on the client, an already
 * signed-in visitor is bounced to the dashboard.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return <LandingV2 />;
}
