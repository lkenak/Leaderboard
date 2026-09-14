"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * État persistant dans `localStorage`.
 *
 * `localStorage` est un magasin externe : on le lit avec
 * `useSyncExternalStore`, ce qui règle trois problèmes d'un coup. Le rendu
 * serveur reçoit la valeur par défaut (`getServerSnapshot`), donc pas d'écart
 * d'hydratation. Deux composants qui observent la même clé restent synchrones.
 * Et l'événement `storage` propage les changements entre onglets.
 *
 * L'instantané est mis en cache par clé : `getSnapshot` doit renvoyer une
 * valeur *référentiellement stable* tant que rien n'a changé, faute de quoi
 * React re-rend en boucle sur un objet fraîchement désérialisé.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) window.addEventListener("storage", emit);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", emit);
  };
}

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Stockage indisponible (navigation privée, cookies bloqués) : la valeur
    // par défaut suffit, la page ne doit pas s'arrêter là-dessus.
    return fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function useStored<T>(key: string, fallback: T): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );

  const update = useCallback(
    (next: T) => {
      const raw = JSON.stringify(next);
      cache.set(key, { raw, value: next });
      try {
        window.localStorage.setItem(key, raw);
      } catch {
        /* idem : on garde la valeur en mémoire pour la session */
      }
      emit();
    },
    [key],
  );

  return [value, update];
}
