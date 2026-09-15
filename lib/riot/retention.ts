/**
 * Rétention des relevés de rang — logique pure, extraite de l'ancien
 * `lib/store.ts` pour rester réutilisable une fois le stockage passé en
 * SQLite (voir `lib/db/riot-players.ts::pruneForPlayer`).
 *
 * Un simple plafond ne suffisait pas : à raison d'un relevé toutes les
 * 30 minutes au repos, 900 entrées ne couvrent que 19 jours — et à peine 3 pour
 * quelqu'un qui joue sans arrêt. La courbe d'un split entier était donc
 * impossible.
 *
 * On garde plutôt **toute la finesse sur 72 h** — c'est ce dont ont besoin la
 * fenêtre de 24 h, les deltas de LP par partie et la variation de place — puis
 * **un relevé par jour au-delà**, en conservant celui du plus haut LP de la
 * journée pour que la courbe garde ses sommets.
 */
import type { Division, Tier } from "@/lib/types";

export interface RetentionSample {
  ts: number;
  tier: Tier;
  division: Division | null;
  leaguePoints: number;
  absoluteLp: number;
  wins: number;
  losses: number;
}

export const FINE_WINDOW_MS = 72 * 3600_000;
/** Filet de sécurité : ~3 ans d'un relevé par jour plus la fenêtre fine. */
export const MAX_SAMPLES = 1200;
export const MAX_GAMES = 40;

export function downsampleSamples<T extends RetentionSample>(samples: T[], now: number): T[] {
  const cutoff = now - FINE_WINDOW_MS;
  const fine = samples.filter((s) => s.ts >= cutoff);

  const perDay = new Map<string, T>();
  for (const sample of samples) {
    if (sample.ts >= cutoff) continue;
    const day = new Date(sample.ts).toISOString().slice(0, 10);
    const best = perDay.get(day);
    if (!best || sample.absoluteLp > best.absoluteLp) perDay.set(day, sample);
  }

  const kept = [...perDay.values(), ...fine].sort((a, b) => a.ts - b.ts);
  return kept.length > MAX_SAMPLES ? kept.slice(-MAX_SAMPLES) : kept;
}
