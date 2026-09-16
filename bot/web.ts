import { getSyncMeta } from "@/lib/db/riot-players";
import { loadEnv } from "./env";

/**
 * Les appels du bot vers le serveur web, sur la boucle locale.
 *
 * Deux usages, et deux seulement :
 *  - déclencher un relevé Riot (`/api/refresh`), parce que le bot n'a pas le
 *    droit d'appeler l'API Riot lui-même ;
 *  - récupérer une carte rendue (`/api/internal/cards/*`), parce que le
 *    moteur de rendu et les polices vivent dans le serveur Next.
 *
 * Tout le reste — classements, joueurs, ladders — se lit directement en base,
 * sans HTTP.
 */

const TIMEOUT_REFRESH_MS = 30_000;
const TIMEOUT_CARTE_MS = 8_000;

async function appeler(chemin: string, timeoutMs: number): Promise<Response> {
  const env = loadEnv();
  const headers: Record<string, string> = {};
  if (env.refreshSecret) headers.Authorization = `Bearer ${env.refreshSecret}`;

  return fetch(`${env.internalUrl}${chemin}`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/* ── Relevé Riot ──────────────────────────────────────────────────────────── */

/**
 * Âge minimal entre deux relevés déclenchés par le bot.
 *
 * `POST /api/refresh` appelle `runSync()` **sans** contrôle d'âge — seul
 * `syncIfStale()` en a un. Le bot est donc le seul garde-fou contre une
 * commande `/classement frais:true` répétée qui brûlerait le quota Riot.
 *
 * Le contrôle se fait sur `sync_meta` **en base** et non sur une variable de
 * ce processus : ça survit à un redémarrage du bot, et ça tient compte des
 * relevés déclenchés par le minuteur systemd ou par une visite du site.
 */
function intervalleMinimalMs(): number {
  const brut = Number(process.env.REFRESH_INTERVAL_MS ?? 300_000);
  return Number.isFinite(brut) ? Math.max(60_000, brut) : 300_000;
}

export type ResultatRefresh =
  | { statut: "lancé" }
  | { statut: "trop-récent"; prochainDansMs: number }
  | { statut: "échec"; message: string };

export async function declencherRefresh(): Promise<ResultatRefresh> {
  const { lastSync } = getSyncMeta();
  const age = lastSync === null ? Infinity : Date.now() - lastSync;
  const minimum = intervalleMinimalMs();
  if (age < minimum) return { statut: "trop-récent", prochainDansMs: minimum - age };

  try {
    const res = await appeler("/api/refresh", TIMEOUT_REFRESH_MS);
    if (!res.ok) return { statut: "échec", message: `le site a répondu ${res.status}` };
    return { statut: "lancé" };
  } catch (err) {
    return { statut: "échec", message: err instanceof Error ? err.message : String(err) };
  }
}

/* ── Cartes ───────────────────────────────────────────────────────────────── */

/**
 * Ce que renvoie une route de carte : l'image **et** tout ce qui doit
 * l'accompagner, en un seul aller-retour.
 *
 * `png` vaut `null` quand le serveur a répondu mais que le rendu a échoué
 * (503) : il nous donne alors quand même `summary` et `fallback`, construits
 * sur le même modèle. C'est ce qui permet à `/classement` de répondre
 * quelque chose d'utile au lieu d'une erreur.
 */
export interface CarteRendue {
  png: Buffer | null;
  alt: string;
  summary: string;
  url: string;
  updatedAt: number;
  fallback: {
    title: string;
    url: string;
    description: string;
    color: number;
    footer: { text: string };
  };
}

interface CartePayload extends Omit<CarteRendue, "png"> {
  png?: string;
}

/**
 * Récupère une carte rendue.
 *
 * Renvoie `null` seulement quand le site est totalement injoignable — dans ce
 * cas l'appelant n'a rien du tout et doit composer son propre message. Toute
 * autre situation (rendu raté, ladder vide) revient avec un contenu
 * exploitable. On ne lève jamais : une commande Discord ne doit pas répondre
 * « erreur » parce qu'une image n'a pas voulu se dessiner.
 */
export async function recupererCarte(chemin: string): Promise<CarteRendue | null> {
  try {
    const res = await appeler(chemin, TIMEOUT_CARTE_MS);

    // 503 = rendu échoué, mais le corps porte le repli. Tout autre code
    // d'erreur est un vrai problème (404 ladder, 401 secret) et n'a pas de
    // contenu utilisable.
    if (!res.ok && res.status !== 503) {
      console.warn(`[bot] carte ${chemin} : le site a répondu ${res.status}`);
      return null;
    }

    const data = (await res.json()) as CartePayload;
    return { ...data, png: data.png ? Buffer.from(data.png, "base64") : null };
  } catch (err) {
    console.warn(`[bot] carte ${chemin} injoignable :`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Comme `recupererCarte`, mais en envoyant le modèle plutôt qu'en le
 * désignant — pour le lobby de PP, dont le modèle mêle des données Discord
 * (noms d'affichage) et des données du site (rangs), et que seul le bot peut
 * assembler.
 */
export async function rendreCarte(
  chemin: string,
  modele: unknown,
): Promise<CarteRendue | null> {
  const env = loadEnv();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.refreshSecret) headers.Authorization = `Bearer ${env.refreshSecret}`;

  try {
    const res = await fetch(`${env.internalUrl}${chemin}`, {
      method: "POST",
      headers,
      body: JSON.stringify(modele),
      signal: AbortSignal.timeout(TIMEOUT_CARTE_MS),
    });

    if (!res.ok && res.status !== 503) {
      console.warn(`[bot] carte ${chemin} : le site a répondu ${res.status}`);
      return null;
    }

    const data = (await res.json()) as CartePayload;
    return { ...data, png: data.png ? Buffer.from(data.png, "base64") : null };
  } catch (err) {
    console.warn(`[bot] carte ${chemin} injoignable :`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Le site répond-il ? Utilisé par `/ping` pour diagnostiquer sans SSH. */
export async function siteJoignable(): Promise<boolean> {
  try {
    const res = await appeler("/login", 5_000);
    return res.ok;
  } catch {
    return false;
  }
}
