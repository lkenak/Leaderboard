"use client";

import { useSyncExternalStore } from "react";

/**
 * Horloge partagée.
 *
 * Le temps est une source de données *externe* à React : le lire avec
 * `useSyncExternalStore` plutôt qu'avec `useState` + `useEffect` évite le rendu
 * en cascade au montage et donne un instantané cohérent à tous les composants
 * qui l'observent au même pas.
 *
 * L'instantané est arrondi au pas demandé, ce qui est indispensable : une
 * fonction `getSnapshot` qui renverrait `Date.now()` brut donnerait une valeur
 * différente à chaque appel et React re-rendrait en boucle.
 */
const subscribers = new Map<number, Set<() => void>>();
const timers = new Map<number, ReturnType<typeof setInterval>>();

function subscribe(stepMs: number, onChange: () => void): () => void {
  let set = subscribers.get(stepMs);
  if (!set) {
    set = new Set();
    subscribers.set(stepMs, set);
    timers.set(
      stepMs,
      setInterval(() => {
        for (const fn of subscribers.get(stepMs) ?? []) fn();
      }, stepMs),
    );
  }
  set.add(onChange);
  return () => {
    set.delete(onChange);
    if (set.size === 0) {
      clearInterval(timers.get(stepMs));
      timers.delete(stepMs);
      subscribers.delete(stepMs);
    }
  };
}

/**
 * @param stepMs pas de rafraîchissement (1 000 ms pour un chronomètre de
 *               partie, 60 000 ms pour un libellé « il y a … »)
 * @param serverNow instantané rendu côté serveur, utilisé jusqu'à l'hydratation
 */
export function useClock(stepMs: number, serverNow: number): number {
  return useSyncExternalStore(
    (onChange) => subscribe(stepMs, onChange),
    () => Math.floor(Date.now() / stepMs) * stepMs,
    () => serverNow,
  );
}
