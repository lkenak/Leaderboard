import { sync, type SyncReport } from "./sync";
import {
  getSyncMeta,
  listPlayersToSync,
  listUnresolvedIdentities,
  setSyncMeta,
  type SyncScope,
} from "@/lib/db/riot-players";
import { MissingKeyError } from "./client";

/**
 * Déclenchement des relevés, et les garde-fous qui vont avec.
 *
 * Trois façons de relever, pour trois besoins qui n'ont rien à voir :
 *
 *  - **le relevé global**, périodique, qui tient à jour tous les comptes
 *    suivis. Il est lent par nature et personne ne l'attend ;
 *  - **le relevé de session**, rapproché, qui ne vise que les joueurs en
 *    train de jouer. Personne ne l'attend non plus, mais c'est lui qui
 *    détermine la qualité de ce qu'on affiche (voir plus bas) ;
 *  - **le relevé ciblé**, déclenché par quelqu'un qui regarde quelque chose
 *    de précis — un bouton sur un classement, l'ajout d'un compte, une
 *    commande du bot. Quelques appels, et on attend le résultat.
 *
 * Le système ne connaissait que le premier. Ajouter un compte revenait donc à
 * attendre qu'un cycle complet veuille bien passer, ce qui pouvait prendre
 * plusieurs minutes — et comme le relevé se déclenchait *après* l'envoi de la
 * page, il fallait encore recharger pour en voir le résultat.
 *
 * Deux garde-fous, dans les deux cas : un **verrou** pour qu'une même portée
 * ne soit pas relevée deux fois en parallèle, et un **âge minimum** pour
 * qu'un clic répété ne se transforme pas en marteau sur l'API Riot.
 */

/** Clé de verrou et de fraîcheur pour une portée. */
function cle(scope: SyncScope): string {
  switch (scope.kind) {
    case "ladder":
      return `ladder:${scope.ladderId}`;
    case "utilisateur":
      return `utilisateur:${scope.userId}`;
    case "en-session":
      return "en-session";
    default:
      return "tout";
  }
}

const enCours = new Map<string, Promise<SyncReport>>();

/**
 * Dernier relevé par portée, en mémoire.
 *
 * En mémoire et non en base, à la différence de `sync_meta` : cette date ne
 * sert qu'à amortir des clics rapprochés. La perdre au redémarrage autorise un
 * relevé de plus, ce qui est sans conséquence — alors qu'une table de plus
 * pour ça n'en vaut pas la peine.
 */
const dernierReleve = new Map<string, number>();

/**
 * Âge minimum d'un relevé ciblé.
 *
 * Bien plus court que l'intervalle global : quelqu'un qui clique sur
 * « Actualiser » vient de faire une partie, ou d'ajouter un compte. Lui
 * répondre « trop tôt » pendant cinq minutes serait absurde. Une minute suffit
 * à empêcher le marteau.
 */
const AGE_MINIMUM_CIBLE_MS = 60_000;

export function isRunning(): boolean {
  return enCours.size > 0;
}

export function hasKey(): boolean {
  return Boolean(process.env.RIOT_API_KEY);
}

/** Intervalle par défaut entre deux relevés globaux, réglable par `REFRESH_INTERVAL_MS`. */
export function refreshIntervalMs(): number {
  const raw = Number(process.env.REFRESH_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 60_000 ? raw : 5 * 60_000;
}

/** Intervalle du relevé de session, réglable par `SESSION_INTERVAL_MS`. */
export function sessionIntervalMs(): number {
  const raw = Number(process.env.SESSION_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 30_000 ? raw : 90_000;
}

/**
 * Lance un relevé, ou rend celui qui tourne déjà sur la même portée.
 *
 * Le verrou est **par portée** : rien n'empêche de relever un ladder pendant
 * qu'un relevé global tourne. Ils se partagent le limiteur de débit de
 * `lib/riot/client.ts`, qui est fait pour ça.
 */
export function runSync(scope: SyncScope = { kind: "tout" }): Promise<SyncReport> {
  const k = cle(scope);
  const existant = enCours.get(k);
  if (existant) return existant;

  const promesse = sync(scope).finally(() => {
    enCours.delete(k);
    dernierReleve.set(k, Date.now());
  });
  enCours.set(k, promesse);
  return promesse;
}

export type ResultatReleve =
  | { statut: "fait"; report: SyncReport }
  | { statut: "trop-récent"; prochainDansMs: number }
  | { statut: "rien-à-faire" }
  | { statut: "sans-clé" }
  | { statut: "échec"; message: string };

/**
 * Relevé ciblé, attendu par l'appelant.
 *
 * Contrairement à `syncIfStale`, celui-ci **renvoie** ce qui s'est passé :
 * il est déclenché par un geste explicite (un bouton, une commande), et la
 * personne qui l'a fait doit savoir si ça a marché.
 */
export async function refreshScope(
  scope: SyncScope,
  { force = false }: { force?: boolean } = {},
): Promise<ResultatReleve> {
  if (!hasKey()) return { statut: "sans-clé" };

  const k = cle(scope);
  if (!force) {
    const dernier = dernierReleve.get(k);
    if (dernier && Date.now() - dernier < AGE_MINIMUM_CIBLE_MS) {
      return { statut: "trop-récent", prochainDansMs: AGE_MINIMUM_CIBLE_MS - (Date.now() - dernier) };
    }
  }

  if (
    listPlayersToSync(scope).length === 0 &&
    listUnresolvedIdentities(scope).length === 0
  ) {
    return { statut: "rien-à-faire" };
  }

  try {
    return { statut: "fait", report: await runSync(scope) };
  } catch (err) {
    if (err instanceof MissingKeyError) return { statut: "sans-clé" };
    return { statut: "échec", message: err instanceof Error ? err.message : String(err) };
  }
}

export const refreshLadder = (ladderId: string, options?: { force?: boolean }) =>
  refreshScope({ kind: "ladder", ladderId }, options);

export const refreshUser = (userId: string, options?: { force?: boolean }) =>
  refreshScope({ kind: "utilisateur", userId }, options);

/**
 * Relevé global si le dernier est périmé.
 *
 * Utilisé par le minuteur systemd et `/api/refresh`, **plus par les pages** :
 * le déclencher à chaque visite faisait travailler l'API Riot pour des
 * visiteurs qui n'avaient rien demandé, et le résultat n'arrivait de toute
 * façon qu'au chargement suivant. Les pages ont maintenant un bouton.
 *
 * Les erreurs sont avalées : l'appelant est une tâche de fond, et une API Riot
 * en panne ne doit pas transformer un classement légèrement daté en page
 * d'erreur.
 */
export async function syncIfStale(): Promise<void> {
  if (!hasKey() || enCours.has("tout")) return;
  try {
    const nothingToTrack =
      listPlayersToSync().length === 0 && listUnresolvedIdentities().length === 0;
    if (nothingToTrack) return;
    const { lastSync } = getSyncMeta();
    if (lastSync && Date.now() - lastSync < refreshIntervalMs()) return;
    const report = await runSync();
    console.log(
      `[riot] relevé : ${report.calls} appels, ${report.newSamples} relevé(s), ${report.newGames} partie(s), ${report.inGame} en jeu, ${report.errors.length} erreur(s) en ${Math.round(report.durationMs / 1000)} s`,
    );
  } catch (err) {
    if (err instanceof MissingKeyError) return;
    console.error("[riot] synchronisation échouée :", err);
    try {
      const { lastSync } = getSyncMeta();
      setSyncMeta(lastSync ?? Date.now(), err instanceof Error ? err.message : String(err));
    } catch {
      // best-effort
    }
  }
}

/**
 * Relevé rapproché des seuls joueurs en session.
 *
 * Ce n'est pas d'abord une optimisation de latence, c'est une question
 * d'exactitude. `fillLpDeltas` n'attribue une variation de LP à une partie que
 * si le relevé qui la précède et celui qui la suit ne sont séparés **que par
 * elle** ; deux parties glissées entre deux relevés ne peuvent plus être
 * départagées, et leur variation reste nulle à jamais. À 5 minutes fixes, une
 * partie sur quatre passait entre les mailles et s'affichait « — ».
 *
 * Sonder toutes les 90 s les seuls joueurs en session garantit un relevé entre
 * deux parties consécutives : chaque partie se retrouve encadrée, donc chiffrée.
 * Le compte rendu d'après-game arrive au passage sous la minute au lieu de
 * trois et demie, mais c'est le bénéfice secondaire.
 *
 * **Le coût reste borné par construction**, sans plafond arbitraire à régler :
 * hors session la portée est vide et aucun appel n'est émis ; en session le
 * verrou de portée empêche deux relevés de se chevaucher, donc un plateau qui
 * mettrait plus de 90 s à être relevé se relève simplement moins souvent —
 * il ne s'empile pas. Le limiteur de `lib/riot/client.ts` fait le reste.
 *
 * Renvoie `null` quand il n'y avait personne à relever : l'appelant distingue
 * « rien à faire » de « fait », ce que le silence ne permettrait pas.
 */
export async function syncSession(): Promise<SyncReport | null> {
  if (!hasKey()) return null;

  const scope: SyncScope = { kind: "en-session" };
  const k = cle(scope);
  // Un relevé de session déjà en vol : ne pas attendre le sien pour en
  // journaliser un doublon. Le minuteur repassera.
  if (enCours.has(k)) return null;

  const dernier = dernierReleve.get(k);
  if (dernier && Date.now() - dernier < sessionIntervalMs()) return null;

  // Requête locale, aucun appel réseau : c'est elle qui rend la voie rapide
  // gratuite la plupart du temps.
  if (listPlayersToSync(scope).length === 0) return null;

  try {
    const report = await runSync(scope);
    console.log(
      `[riot] session : ${report.accounts} joueur(s), ${report.calls} appels, ` +
        `${report.newSamples} relevé(s), ${report.newGames} partie(s), ` +
        `${report.queued} en file, ${report.inGame} en jeu, ${report.errors.length} erreur(s) ` +
        `en ${Math.round(report.durationMs / 1000)} s`,
    );
    return report;
  } catch (err) {
    if (err instanceof MissingKeyError) return null;
    // Avalé comme dans `syncIfStale` : l'appelant est une tâche de fond, et le
    // relevé global reste le filet. Pas d'écriture dans `sync_meta`, qui date
    // le relevé **global** et lui seul.
    console.error("[riot] relevé de session échoué :", err);
    return null;
  }
}

/** Résumé lisible d'un relevé, pour un bouton ou une commande. */
export function resumerReleve(resultat: ResultatReleve): string {
  switch (resultat.statut) {
    case "fait": {
      const r = resultat.report;
      const bouts = [`${r.calls} appels`];
      if (r.resolved > 0) bouts.push(`${r.resolved} compte(s) résolu(s)`);
      bouts.push(`${r.newSamples} relevé(s)`, `${r.newGames} partie(s)`);
      if (r.inGame > 0) bouts.push(`${r.inGame} en jeu`);
      if (r.errors.length > 0) bouts.push(`${r.errors.length} erreur(s)`);
      return bouts.join(" · ");
    }
    case "trop-récent":
      return `Déjà relevé il y a moins d'une minute — réessaie dans ${Math.ceil(
        resultat.prochainDansMs / 1000,
      )} s.`;
    case "rien-à-faire":
      return "Aucun compte à relever ici.";
    case "sans-clé":
      return "Aucune clé Riot configurée sur le serveur.";
    case "échec":
      return resultat.message;
  }
}
