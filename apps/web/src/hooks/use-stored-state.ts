"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = () => fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
};

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * State kept in localStorage (per browser) — for view preferences like visible columns.
 * Renders `initial` on the server and until the stored value is read, so markup matches.
 */
export function useStoredState<T>(key: string, initial: T): [T, (next: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  let value = initial;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  }
  const set = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage can be full or blocked; the preference just won't stick.
      }
      for (const fn of listeners) fn();
    },
    [key],
  );
  return [value, set];
}
