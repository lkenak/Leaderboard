/**
 * Modèle de données du classement.
 *
 * Les noms de champs suivent volontairement l'API Riot (`tier`, `division`,
 * `leaguePoints`, `wins`, `losses`, `puuid`, `gameName`/`tagLine`, `championName`)
 * afin que le branchement sur `lib/riot/` se limite à un adaptateur, sans
 * renommage dans les composants.
 */

export const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;
export type Tier = (typeof TIERS)[number];

/** Les paliers sans division : un seul palier continu au-dessus de Diamant I. */
export const APEX_TIERS: Tier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];

export const DIVISIONS = ["IV", "III", "II", "I"] as const;
export type Division = (typeof DIVISIONS)[number];

export const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type Role = (typeof ROLES)[number];

export type Region = "EUW" | "EUNE" | "NA" | "KR" | "BR" | "LAN" | "TR";

/** Le rang tel que le renvoie `league-v4/entries` (division absente en apex). */
export interface RankSnapshot {
  tier: Tier;
  division: Division | null;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface StreamerHandle {
  platform: "twitch" | "kick" | "youtube";
  login: string;
}

export interface ChampionStat {
  championId: string; // clé Data Dragon, ex. « Aatrox »
  championName: string; // libellé lisible, ex. « Aatrox »
  games: number;
  wins: number;
  kda: number;
}

/** Une partie classée terminée, dans l'ordre antéchronologique. */
export interface GameRecord {
  id: string;
  championId: string;
  championName: string;
  role: Role;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  /** Delta de LP réellement observé (gains/pertes variables selon le MMR). */
  lpDelta: number;
  durationSec: number;
  /** Horodatage de fin de partie, en ms. */
  endedAt: number;
  cs: number;
  visionScore: number;
}

/** La partie en cours, quand `spectator-v5` renvoie quelque chose. */
export interface LiveGame {
  championId: string;
  championName: string;
  role: Role;
  /** Début de partie en ms — la durée est recalculée côté client. */
  startedAt: number;
}

export interface Player {
  puuid: string;
  slug: string;
  gameName: string;
  tagLine: string;
  region: Region;
  profileIconId: number;
  summonerLevel: number;
  /** Nom d'affichage court, quand le pseudo Riot n'est pas le nom public. */
  displayName?: string;
  team?: { id: string; name: string; tag: string };
  mainRole: Role;
  streamer?: StreamerHandle;
  country?: string;
}

/** Une ligne de classement : joueur + rang + tout ce qui en est dérivé. */
export interface RankingEntry {
  player: Player;
  /** Sélection d'origine — sert au rail de couleur dans la vue fusionnée. */
  bracket: "high-elo" | "low-elo";
  rank: RankSnapshot;
  /** LP absolus, tous paliers confondus — la clé de tri du classement. */
  absoluteLp: number;
  /** Position actuelle (1-indexée) et variation depuis le relevé de la veille. */
  position: number;
  positionDelta: number;
  /** Bilan des dernières 24 h. */
  session: { lp: number; wins: number; losses: number; games: number };
  /** Forme récente, la partie la plus récente en premier. */
  form: boolean[];
  streak: { type: "win" | "loss" | "none"; count: number };
  winrate: number;
  games: number;
  kda: number;
  champions: ChampionStat[];
  /** Série de LP absolus pour la courbe (ancien → récent). */
  lpHistory: number[];
  peakAbsoluteLp: number;
  live: LiveGame | null;
  recentGames: GameRecord[];
  /** Dernière partie enregistrée, en ms — sert au libellé « il y a … ». */
  lastGameAt: number;
}

export interface RankingSnapshot {
  /** Identifiant de la sélection (ex. « high-elo »). */
  bracketId: string;
  splitName: string;
  /** Fin du split, en ms — alimente le compte à rebours. */
  splitEndsAt: number;
  updatedAt: number;
  /** LP exigés par la dernière place de chaque palier apex, région EUW. */
  cutoff: { challenger: number; grandmaster: number };
  entries: RankingEntry[];
}
