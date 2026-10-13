import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number = 120): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    if (delayMs <= 0 || process.env.NODE_ENV === "test") {
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return delayMs <= 0 || process.env.NODE_ENV === "test" ? value : debounced;
}
