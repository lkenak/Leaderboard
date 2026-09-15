import { sync, type SyncReport } from "./sync";
import * as store from "@/lib/store";
import { MissingKeyError } from "./client";

/**
 * Déclenchement de la synchronisation, avec deux garde-fous.
 *
 * Un **verrou de processus** : la page déclenche un rafraîchissement en arrière-
 * plan quand le relevé est périmé, et plusieurs visiteurs simultanés
 * lanceraient autant de synchronisations concurrentes — de quoi épuiser le
 * quota Riot en quelques secondes et écrire par-dessus soi-même.
 *
 * Un **âge minimum** : on ne resynchronise pas si le dernier relevé est récent.
 */
let running: Promise<SyncReport> | null = null;

export function isRunning(): boolean {
  return running !== null;
}

export function hasKey(): boolean {
  return Boolean(process.env.RIOT_API_KEY);
}

/** Intervalle par défaut entre deux relevés, réglable par `REFRESH_INTERVAL_MS`. */
export function refreshIntervalMs(): number {
  const raw = Number(process.env.REFRESH_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 60_000 ? raw : 5 * 60_000;
}

export function runSync(): Promise<SyncReport> {
  if (running) return running;
  running = sync().finally(() => {
    running = null;
  });
  return running;
}

/**
 * Synchronise seulement si le relevé est plus vieux que l'intervalle. Les
 * erreurs sont avalées : cette fonction est appelée depuis `after()`, après que
 * la réponse a été envoyée, et une API Riot en panne ne doit pas transformer un
 * classement légèrement daté en page d'erreur.
 */
export async function syncIfStale(): Promise<void> {
  if (!hasKey() || isRunning()) return;
  try {
    const data = await store.read();
    if (data.roster.length === 0) return;
    if (data.lastSync && Date.now() - data.lastSync < refreshIntervalMs()) return;
    const report = await runSync();
    console.log(
      `[riot] relevé : ${report.calls} appels, ${report.newSamples} relevé(s), ${report.newGames} partie(s), ${report.inGame} en jeu, ${report.errors.length} erreur(s) en ${Math.round(report.durationMs / 1000)} s`,
    );
  } catch (err) {
    if (err instanceof MissingKeyError) return;
    console.error("[riot] synchronisation échouée :", err);
    await store
      .update((s) => {
        s.lastSyncError = err instanceof Error ? err.message : String(err);
      })
      .catch(() => undefined);
  }
}
