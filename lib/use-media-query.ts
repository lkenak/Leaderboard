"use client";

import { useSyncExternalStore } from "react";

/**
 * Requête média observée comme la source externe qu'elle est. `serverValue`
 * est la réponse rendue côté serveur, où aucun média n'est connaissable.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
