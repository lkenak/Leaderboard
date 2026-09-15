import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  Division,
  GameRecord,
  LiveGame,
  Region,
  Role,
  StreamerHandle,
  Tier,
} from "./types";

/**
 * Stockage local du classement.
 *
 * Pourquoi un fichier et pas une base : tout ce qu'il faut retenir tient dans
 * quelques centaines de kilo-octets (un plateau d'amis, deux relevés par heure
 * et par joueur, quarante parties chacun), et une base imposerait un service à
 * provisionner avant que quoi que ce soit ne fonctionne. Le module est
 * volontairement la seule porte d'entrée : le jour où le site est déployé sur
 * un hébergement au système de fichiers en lecture seule, il suffit de
 * réimplémenter `read`/`write` sur Postgres — rien d'autre ne touche au disque.
 *
 * Deux choses justifient à elles seules l'existence de ce stockage, et aucune
 * API ne peut les remplacer :
 *  1. **Le delta de LP d'une partie.** `match-v5` ne renvoie aucun LP. Le gain
 *     d'une partie, c'est la différence entre les deux relevés qui l'encadrent.
 *  2. **La variation de place sur 24 h**, qui suppose de connaître le
 *     classement d'hier.
 */

const DATA_DIR = process.env.LADDER_DATA_DIR ?? join(process.cwd(), ".data");
const STORE_PATH = join(DATA_DIR, "store.json");

export type Bracket = "high-elo" | "low-elo";

export interface RosterAccount {
  /** Identifiant stable, indépendant du Riot ID (qui peut être renommé). */
  id: string;
  gameName: string;
  tagLine: string;
  region: Region;
  bracket: Bracket;
  addedAt: number;

  /** Renseignés à la main depuis /admin, facultatifs. */
  country?: string;
  teamName?: string;
  teamTag?: string;
  streamer?: StreamerHandle;
  /** Forcé à la main ; sinon déduit du poste le plus joué. */
  roleOverride?: Role;

  /** Résolus par la synchronisation. */
  puuid?: string;
  profileIconId?: number;
  summonerLevel?: number;
  /**
   * Meilleur LP absolu jamais relevé. Persisté ici, et non recalculé depuis
   * les relevés : ceux-ci sont sous-échantillonnés avec le temps, donc un pic
   * atteint il y a trois mois entre deux points conservés disparaîtrait, et le
   * « pic de la saison » régresserait silencieusement.
   */
  peakAbsoluteLp?: number;
  /** Dernière erreur de résolution (Riot ID introuvable, région erronée…). */
  error?: string;
}

/** Un relevé de rang. C'est la seule série temporelle que l'on conserve. */
export interface LpSample {
  ts: number;
  tier: Tier;
  division: Division | null;
  leaguePoints: number;
  absoluteLp: number;
  wins: number;
  losses: number;
}

export interface ApexCutoff {
  challenger: number;
  grandmaster: number;
  fetchedAt: number;
}

export interface StoreShape {
  version: 1;
  roster: RosterAccount[];
  /** Par puuid, du plus ancien au plus récent. */
  samples: Record<string, LpSample[]>;
  /** Par puuid, du plus récent au plus ancien. */
  games: Record<string, GameRecord[]>;
  live: Record<string, LiveGame | null>;
  /** Par plateforme (`euw1`…). */
  cutoffs: Record<string, ApexCutoff>;
  lastSync: number | null;
  lastSyncError: string | null;
}

const EMPTY: StoreShape = {
  version: 1,
  roster: [],
  samples: {},
  games: {},
  live: {},
  cutoffs: {},
  lastSync: null,
  lastSyncError: null,
};

/* ── Lecture / écriture ───────────────────────────────────────────────────── */

export async function read(): Promise<StoreShape> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    // Fusion avec EMPTY : un fichier écrit par une version antérieure du
    // schéma ne doit pas faire planter la page sur une clé absente.
    return { ...EMPTY, ...parsed };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
    throw err;
  }
}

/**
 * Les écritures sont sérialisées et atomiques : deux requêtes simultanées
 * (l'ajout d'un compte pendant une synchronisation) écriraient sinon l'une par
 * dessus l'autre, et une interruption en pleine écriture laisserait un JSON
 * tronqué — donc un site cassé jusqu'à suppression du fichier.
 */
let queue: Promise<unknown> = Promise.resolve();

export function update<T>(
  mutate: (store: StoreShape) => T | Promise<T>,
): Promise<T> {
  const run = async (): Promise<T> => {
    const store = await read();
    const result = await mutate(store);
    await mkdir(dirname(STORE_PATH), { recursive: true });
    const tmp = `${STORE_PATH}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(store, null, 1), "utf8");
    await rename(tmp, STORE_PATH);
    return result;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/* ── Opérations sur le plateau ────────────────────────────────────────────── */

export function accountId(gameName: string, tagLine: string, region: Region) {
  return `${region}:${gameName}#${tagLine}`.toLowerCase();
}

export class DuplicateAccountError extends Error {
  constructor(label: string) {
    super(`${label} est déjà dans le plateau.`);
    this.name = "DuplicateAccountError";
  }
}

export function addAccount(input: {
  gameName: string;
  tagLine: string;
  region: Region;
  bracket: Bracket;
  country?: string;
  teamName?: string;
  teamTag?: string;
  streamer?: StreamerHandle;
  roleOverride?: Role;
}): Promise<RosterAccount> {
  return update((store) => {
    const id = accountId(input.gameName, input.tagLine, input.region);
    if (store.roster.some((a) => a.id === id)) {
      throw new DuplicateAccountError(`${input.gameName}#${input.tagLine}`);
    }
    const account: RosterAccount = { id, addedAt: Date.now(), ...input };
    store.roster.push(account);
    return account;
  });
}

export function removeAccount(id: string): Promise<void> {
  return update((store) => {
    const account = store.roster.find((a) => a.id === id);
    store.roster = store.roster.filter((a) => a.id !== id);
    // On purge aussi les séries : garder l'historique d'un compte retiré ne
    // sert à rien et le fichier ne cesserait jamais de grossir.
    if (account?.puuid) {
      delete store.samples[account.puuid];
      delete store.games[account.puuid];
      delete store.live[account.puuid];
    }
  });
}

export function patchAccount(
  id: string,
  patch: Partial<RosterAccount>,
): Promise<void> {
  return update((store) => {
    const account = store.roster.find((a) => a.id === id);
    if (account) Object.assign(account, patch);
  });
}

/* ── Rétention ────────────────────────────────────────────────────────────── */

/**
 * Rétention des relevés.
 *
 * Un simple plafond ne suffisait pas : à raison d'un relevé toutes les
 * 30 minutes au repos, 900 entrées ne couvrent que 19 jours — et à peine 3 pour
 * quelqu'un qui joue sans arrêt. La courbe d'un split entier était donc
 * impossible.
 *
 * On garde plutôt **toute la finesse sur 72 h** — c'est ce dont ont besoin la
 * fenêtre de 24 h, les deltas de LP par partie et la variation de place — puis
 * **un relevé par jour au-delà**, en conservant celui du plus haut LP de la
 * journée pour que la courbe garde ses sommets. Le fichier reste petit (autour
 * de 40 Ko par joueur), ce qui compte : il est relu à chaque rendu de page.
 */
const FINE_WINDOW_MS = 72 * 3600_000;
/** Filet de sécurité : ~3 ans d'un relevé par jour plus la fenêtre fine. */
const MAX_SAMPLES = 1200;
const MAX_GAMES = 40;

function downsample(samples: LpSample[], now: number): LpSample[] {
  const cutoff = now - FINE_WINDOW_MS;
  const fine = samples.filter((s) => s.ts >= cutoff);

  // Au-delà de la fenêtre fine : un relevé par jour, celui du LP le plus haut.
  const perDay = new Map<string, LpSample>();
  for (const sample of samples) {
    if (sample.ts >= cutoff) continue;
    const day = new Date(sample.ts).toISOString().slice(0, 10);
    const best = perDay.get(day);
    if (!best || sample.absoluteLp > best.absoluteLp) perDay.set(day, sample);
  }

  const kept = [...perDay.values(), ...fine].sort((a, b) => a.ts - b.ts);
  return kept.length > MAX_SAMPLES ? kept.slice(-MAX_SAMPLES) : kept;
}

export function prune(store: StoreShape, now = Date.now()): void {
  for (const [puuid, samples] of Object.entries(store.samples)) {
    store.samples[puuid] = downsample(samples, now);
  }
  for (const [puuid, games] of Object.entries(store.games)) {
    if (games.length > MAX_GAMES) store.games[puuid] = games.slice(0, MAX_GAMES);
  }
}
