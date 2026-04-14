import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface BreadcrumbState {
  labels: Record<string, string>;
  setLabel: (id: string, label: string) => void;
}

const sessionStore = (): Storage | undefined =>
  typeof window !== 'undefined' ? window.sessionStorage : undefined;

export const useBreadcrumbStore = create<BreadcrumbState>()(
  persist(
    (set) => ({
      labels: {},
      setLabel: (id, label) =>
        set((s) => {
          if (!id || !label || s.labels[id] === label) return s;
          return { labels: { ...s.labels, [id]: label } };
        }),
    }),
    {
      name: 'breadcrumb-labels',
      storage: createJSONStorage(() => sessionStore() as Storage),
    },
  ),
);
