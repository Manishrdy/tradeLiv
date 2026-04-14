import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LandingV2 from './landing-v2/LandingV2';

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  const refresh = cookieStore.get('refresh');

  if (session?.value || refresh?.value) {
    redirect('/dashboard');
  }

  return <LandingV2 />;
}
