'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Check if this is a standard Webpack chunk loading / module load error
    // Typical symptoms of a stale client session attempting to load missing chunks
    const message = error.message?.toLowerCase() || '';
    if (
      message.includes('e[o] is not a function') ||
      message.includes('chunk load failed') ||
      message.includes('failed to fetch dynamically imported module') ||
      message.includes('module_not_found') ||
      message.includes('webpack')
    ) {
      // Hard refresh organic-heals the client session by fetching the latest Next.js build chunks
      window.location.reload();
    } else {
      console.error('Unhandled React Error Boundary:', error);
    }
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-app, #f9fafb)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#fff',
        padding: '32px 40px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        textAlign: 'center',
        maxWidth: '480px',
        width: '90%'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 12px 0'
        }}>
          Something went wrong
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          lineHeight: '1.5',
          margin: '0 0 24px 0'
        }}>
          We experienced an unexpected issue loading this page. 
          Refreshing usually resolves the problem.
        </p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#2d5f7a',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
