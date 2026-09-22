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
  /**
   * Delta de LP observé. `null` quand il est inconnu : `match-v5` ne renvoie
   * aucun LP, le gain se déduit de deux relevés encadrant la partie. Les
   * parties antérieures au premier relevé n'en auront donc jamais.
   */
  lpDelta: number | null;
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
  mainRole: Role;
  country?: string;
}

/** Une ligne de classement : joueur + rang + tout ce qui en est dérivé. */
export interface RankingEntry {
  player: Player;
  rank: RankSnapshot;
  /** LP absolus, tous paliers confondus — la clé de tri du classement. */
  absoluteLp: number;
  /** Position actuelle (1-indexée) et variation depuis le relevé de la veille. */
  position: number;
  positionDelta: number;
  /**
   * Bilan des dernières 24 h.
   *
   * `lp` est `null` tant qu'aucun relevé ne permet de l'établir : le nombre de
   * victoires et de défaites vient de l'historique des parties, disponible dès
   * le premier appel, mais la variation de LP suppose deux relevés encadrant la
   * fenêtre. `partial` signale une fenêtre plus courte que 24 h, faute
   * d'historique assez profond.
   */
  session: {
    lp: number | null;
    wins: number;
    losses: number;
    games: number;
    partial: boolean;
  };
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
  /**
   * Dernière partie enregistrée, en ms. `null` quand aucune partie classée
   * n'est connue — cas d'un compte tout juste ajouté au plateau.
   */
  lastGameAt: number | null;
}

/** Runes d'un participant, telles que renvoyées par `perks` de match-v5. */
export interface RuneSelection {
  primaryStyle: number;
  subStyle: number;
  /** Les 6 runes choisies, arbre primaire (4) puis secondaire (2). */
  selections: number[];
  /** Les 3 fragments de statistique. */
  shards: number[];
}

/**
 * Détail complet d'un participant d'une partie — build, runes, sorts,
 * dégâts. Contrairement à `GameRecord`, existe pour les **10** joueurs d'une
 * partie, pas seulement pour un compte suivi ; `puuid`/`gameName`/`tagLine`
 * identifient un adversaire qui n'est peut-être suivi par aucun ladder.
 */
export interface MatchParticipantDetail {
  participantId: number;
  puuid: string;
  gameName: string;
  tagLine: string;
  teamId: 100 | 200;
  championId: string;
  championName: string;
  role: Role;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  visionScore: number;
  champLevel: number;
  goldEarned: number;
  damageDealt: number;
  damageTaken: number;
  summoner1Id: number;
  summoner2Id: number;
  /** item0..item6 dans l'ordre Riot, trinket inclus ; 0 = emplacement vide. */
  items: number[];
  runes: RuneSelection;
}

/** Détail complet d'une partie, pour les 10 joueurs — voir lib/db/match-details.ts. */
export interface MatchDetail {
  id: string;
  queueId: number;
  gameVersion: string;
  durationSec: number;
  startedAt: number;
  endedAt: number;
  /** Un point par minute : or cumulé de chaque équipe. */
  goldTimeline: Array<{ minute: number; blueGold: number; redGold: number }>;
  participants: MatchParticipantDetail[];
}

export interface RankingSnapshot {
  splitName: string;
  /**
   * Fin du split, en ms. `null` quand elle n'est pas renseignée
   * (`SPLIT_ENDS_AT`) : le compte à rebours disparaît plutôt que d'afficher une
   * date inventée.
   */
  splitEndsAt: number | null;
  updatedAt: number;
  entries: RankingEntry[];
}
