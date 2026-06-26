import { useMemo } from 'react';
import {
  useNavigate,
  useLocation,
  useParams as rrUseParams,
  useSearchParams as rrUseSearchParams,
} from 'react-router-dom';

/**
 * Compatibility shim for `next/navigation`, backed by react-router. Lets pages keep
 * importing { useRouter, usePathname, useSearchParams, useParams } unchanged.
 */

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => {},
      prefetch: () => {},
    }),
    [navigate],
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

/** Next's useSearchParams returns the read-only URLSearchParams directly. */
export function useSearchParams(): URLSearchParams {
  const [searchParams] = rrUseSearchParams();
  return searchParams;
}

export const useParams = rrUseParams;
