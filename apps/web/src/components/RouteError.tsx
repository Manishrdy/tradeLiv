import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

/**
 * react-router errorElement. Mirrors the old Next error boundary: auto-reloads on
 * stale-chunk / dynamic-import failures (common after a redeploy), otherwise shows
 * a friendly retry card.
 */
export default function RouteError() {
  const error = useRouteError() as (Error & { digest?: string }) | undefined;

  useEffect(() => {
    const message = error?.message?.toLowerCase() || '';
    if (
      message.includes('failed to fetch dynamically imported module') ||
      message.includes('error loading dynamically imported module') ||
      message.includes('chunk load failed') ||
      message.includes('module_not_found')
    ) {
      window.location.reload();
    } else if (error) {
      console.error('Unhandled route error:', error);
    }
  }, [error]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-app, #f9fafb)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff', padding: '32px 40px', borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center',
        maxWidth: '480px', width: '90%',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 12px 0' }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 24px 0' }}>
          We experienced an unexpected issue loading this page. Refreshing usually resolves the problem.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#2d5f7a', color: '#fff', border: 'none', borderRadius: '6px',
            padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
