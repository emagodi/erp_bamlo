"use client";

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type LoadingContextValue = {
  pending: boolean;
  start: () => void;
  stop: () => void;
};

const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const start = useCallback(() => {
    setCount((current) => current + 1);
  }, []);

  const stop = useCallback(() => {
    setCount((current) => (current > 0 ? current - 1 : 0));
  }, []);

  const value = useMemo<LoadingContextValue>(
    () => ({ pending: count > 0, start, stop }),
    [count, start, stop],
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return ctx;
}
