import { markKeyRejected, riotKey } from "./key";
import { clusterHost, platformHost } from "./routing";
import type { Region } from "@/lib/types";

/**
 * Client Riot minimal : un limiteur de débit, une gestion explicite du 404 et
 * rien d'autre. Pas de librairie tierce — la surface utilisée ici est de six
 * endpoints, et une dépendance de plus serait surtout une dépendance de plus à
 * suivre quand Riot déprécie une route.
 */

export class RiotError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message?: string,
  ) {
    super(message ?? `Riot API ${status} sur ${path}`);
    this.name = "RiotError";
  }
}

/** Clé absente : distingué du reste pour pouvoir basculer en mode démonstration. */
export class MissingKeyError extends Error {
  constructor() {
    super(
      "Aucune clé Riot. La coller depuis /admin, ou la placer dans RIOT_API_KEY.",
    );
    this.name = "MissingKeyError";
  }
}

/**
 * Limiteur à deux seaux, calé sur les quotas d'une clé personnelle :
 * 20 requêtes/s et 100 requêtes/2 min. Les deux fenêtres sont glissantes, on
 * garde donc l'horodatage de chaque appel plutôt qu'un simple compteur —
 * un compteur remis à zéro toutes les 2 min autorise 200 appels à cheval sur
 * la bascule et déclenche un 429.
 */
class RateLimiter {
  private readonly hits: number[] = [];

  constructor(
    private readonly windows: Array<{ ms: number; max: number }> = [
      { ms: 1_000, max: 18 }, // 18 au lieu de 20 : marge pour l'horloge serveur
      { ms: 120_000, max: 95 },
    ],
  ) {}

  /** Attend le temps nécessaire pour que l'appel suivant reste dans les quotas. */
  async take(): Promise<void> {
    for (;;) {
      const now = Date.now();
      const longest = Math.max(...this.windows.map((w) => w.ms));
      while (this.hits.length > 0 && now - this.hits[0] > longest) this.hits.shift();

      let wait = 0;
      for (const w of this.windows) {
        const inWindow = this.hits.filter((t) => now - t < w.ms);
        if (inWindow.length >= w.max) {
          wait = Math.max(wait, w.ms - (now - inWindow[0]) + 5);
        }
      }
      if (wait === 0) {
        this.hits.push(now);
        return;
      }
      await sleep(wait);
    }
  }

  /** Nombre d'appels consommés sur la fenêtre de 2 min — pour le journal. */
  get recent(): number {
    const now = Date.now();
    return this.hits.filter((t) => now - t < 120_000).length;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const limiter = new RateLimiter();

/** Fenêtre glissante de 2 min — sert à savoir où l'on en est du quota. */
export function callsInWindow(): number {
  return limiter.recent;
}

/** Compteur monotone depuis le démarrage — sert au rapport de synchronisation,
 *  qui peut durer plus longtemps que la fenêtre du limiteur. */
let totalCalls = 0;
export function callsTotal(): number {
  return totalCalls;
}

interface GetOptions {
  /** `true` : un 404 renvoie `null` au lieu de lever (joueur hors partie…). */
  allow404?: boolean;
  /** Nombre de tentatives après un 429 ou une erreur serveur. */
  retries?: number;
}

async function get<T>(
  url: string,
  { allow404 = false, retries = 3 }: GetOptions = {},
): Promise<T | null> {
  const key = await riotKey();
  if (!key) throw new MissingKeyError();

  for (let attempt = 0; ; attempt++) {
    await limiter.take();
    totalCalls++;
    const res = await fetch(url, {
      headers: { "X-Riot-Token": key },
      cache: "no-store",
    });

    if (res.ok) return (await res.json()) as T;
    if (res.status === 404 && allow404) return null;

    // 429 : Riot indique lui-même combien de temps patienter.
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
      await sleep(retryAfter > 0 ? retryAfter * 1000 + 250 : 2 ** attempt * 1000);
      continue;
    }

    const path = new URL(url).pathname;
    if (res.status === 401 || res.status === 403) {
      // On note le refus : c'est ce qui arrête le relevé automatique et fait
      // apparaître le bandeau « clé expirée » plutôt que de laisser le site
      // cogner l'API toutes les cinq minutes avec une clé morte.
      await markKeyRejected(key);
      throw new RiotError(
        res.status,
        path,
        "Clé Riot refusée (401/403) : elle est invalide, expirée — une clé de développement meurt toutes les 24 h — ou ne couvre pas cet endpoint.",
      );
    }
    throw new RiotError(res.status, path);
  }
}

/* ── Vérification d'une clé ───────────────────────────────────────────────── */

export type KeyCheck = { ok: true } | { ok: false; reason: string };

/**
 * Essaie une clé avant de la retenir.
 *
 * L'appel choisi ne prend aucun paramètre et ne dépend d'aucun compte : la
 * liste Challenger existe toujours. Coller une clé et savoir tout de suite si
 * elle est bonne vaut mieux que de le découvrir au relevé suivant, devant un
 * classement resté vide.
 *
 * La clé est passée en argument, et non lue par `riotKey()`, parce qu'on la
 * vérifie précisément *avant* de la ranger.
 */
export async function checkKey(
  key: string,
  region: Region = "EUW",
): Promise<KeyCheck> {
  await limiter.take();
  totalCalls++;
  let res: Response;
  try {
    res = await fetch(
      `${platformHost(region)}/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`,
      { headers: { "X-Riot-Token": key }, cache: "no-store" },
    );
  } catch (err) {
    return {
      ok: false,
      reason: `API Riot injoignable : ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (res.ok) return { ok: true };
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      reason:
        "Riot refuse cette clé (401/403) : expirée, mal copiée, ou régénérée depuis. En reprendre une sur le portail.",
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      reason: "Quota Riot dépassé pour l'instant. Réessayer dans deux minutes.",
    };
  }
  return { ok: false, reason: `API Riot en erreur (HTTP ${res.status}).` };
}

/* ── Les six appels dont le classement a besoin ───────────────────────────── */

export interface AccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface SummonerDto {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
  revisionDate: number;
}

export interface LeagueEntryDto {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
}

export interface ActiveGameDto {
  gameId: number;
  gameStartTime: number;
  gameLength: number;
  gameQueueConfigId: number;
  participants: Array<{ puuid: string; championId: number; teamId: number }>;
}

export interface MatchDto {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameEndTimestamp?: number;
    gameStartTimestamp: number;
    gameDuration: number;
    queueId: number;
    participants: Array<{
      puuid: string;
      championName: string;
      championId: number;
      teamPosition: string;
      individualPosition: string;
      win: boolean;
      kills: number;
      deaths: number;
      assists: number;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      visionScore: number;
      gameEndedInEarlySurrender: boolean;
      challenges?: Record<string, number>;
    }>;
  };
}

/** Riot ID → puuid. Le seul appel qui prend un nom en clair. */
export function accountByRiotId(
  region: Region,
  gameName: string,
  tagLine: string,
) {
  return get<AccountDto>(
    `${clusterHost(region)}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { allow404: true },
  );
}

export function summonerByPuuid(region: Region, puuid: string) {
  return get<SummonerDto>(
    `${platformHost(region)}/lol/summoner/v4/summoners/by-puuid/${puuid}`,
    { allow404: true },
  );
}

/** Toutes les files ; c'est à l'appelant de retenir `RANKED_SOLO_5x5`. */
export function leagueEntriesByPuuid(region: Region, puuid: string) {
  return get<LeagueEntryDto[]>(
    `${platformHost(region)}/lol/league/v4/entries/by-puuid/${puuid}`,
    { allow404: true },
  );
}

/** 404 attendu et fréquent : le joueur n'est simplement pas en partie. */
export function activeGame(region: Region, puuid: string) {
  return get<ActiveGameDto>(
    `${platformHost(region)}/lol/spectator/v5/active-games/by-summoner/${puuid}`,
    { allow404: true },
  );
}

export function rankedMatchIds(region: Region, puuid: string, count: number) {
  return get<string[]>(
    `${clusterHost(region)}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`,
  );
}

export function match(region: Region, matchId: string) {
  return get<MatchDto>(
    `${clusterHost(region)}/lol/match/v5/matches/${matchId}`,
    { allow404: true },
  );
}
