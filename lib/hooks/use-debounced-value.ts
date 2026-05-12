"use client";

import { useEffect, useState } from "react";

/** Atrasa atualização (ex.: texto de busca) para reduzir chamadas à API Serper. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
