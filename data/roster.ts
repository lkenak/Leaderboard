import type { Region, Role, StreamerHandle } from "@/lib/types";

/**
 * Le plateau suivi. C'est le seul fichier à éditer pour changer les joueurs
 * du classement : `lib/riot/` résoudra chaque entrée en puuid puis en rang.
 * Les pseudos sont fictifs — aucun compte réel n'est visé.
 */
export interface RosterTeam {
  id: string;
  name: string;
  tag: string;
}

export const TEAMS: RosterTeam[] = [
  { id: "vlt", name: "Voltaic", tag: "VLT" },
  { id: "nkt", name: "Noctem", tag: "NKT" },
  { id: "bsl", name: "Basilisk", tag: "BSL" },
  { id: "kra", name: "Karma Esport", tag: "KRA" },
  { id: "hlx", name: "Helix", tag: "HLX" },
  { id: "obs", name: "Obsidian", tag: "OBS" },
];

export interface RosterMember {
  gameName: string;
  tagLine: string;
  region: Region;
  mainRole: Role;
  profileIconId: number;
  teamId?: string;
  streamer?: StreamerHandle;
  country?: string;
  /** Sélection : le plateau est scindé en deux tableaux comme sur l'original. */
  bracket: "high-elo" | "low-elo";
}

export const ROSTER: RosterMember[] = [
  // ── High elo ──────────────────────────────────────────────────────────────
  { gameName: "Kaelthas", tagLine: "EUW", region: "EUW", mainRole: "MIDDLE", profileIconId: 588, teamId: "vlt", streamer: { platform: "twitch", login: "kaelthas" }, country: "FR", bracket: "high-elo" },
  { gameName: "Nyrelle", tagLine: "SOLO", region: "EUW", mainRole: "JUNGLE", profileIconId: 590, teamId: "nkt", streamer: { platform: "twitch", login: "nyrelle" }, country: "FR", bracket: "high-elo" },
  { gameName: "Vorpal", tagLine: "666", region: "EUW", mainRole: "TOP", profileIconId: 592, teamId: "bsl", country: "BE", bracket: "high-elo" },
  { gameName: "Saphirya", tagLine: "ADC", region: "EUW", mainRole: "BOTTOM", profileIconId: 594, teamId: "vlt", streamer: { platform: "kick", login: "saphirya" }, country: "FR", bracket: "high-elo" },
  { gameName: "Oberyn", tagLine: "SUP", region: "EUW", mainRole: "UTILITY", profileIconId: 596, teamId: "kra", country: "ES", bracket: "high-elo" },
  { gameName: "Tenzo", tagLine: "EUW", region: "EUW", mainRole: "MIDDLE", profileIconId: 598, teamId: "hlx", streamer: { platform: "twitch", login: "tenzo" }, country: "FR", bracket: "high-elo" },
  { gameName: "Drakhen", tagLine: "TOP", region: "EUW", mainRole: "TOP", profileIconId: 600, teamId: "obs", country: "DE", bracket: "high-elo" },
  { gameName: "Milva", tagLine: "JGL", region: "EUW", mainRole: "JUNGLE", profileIconId: 602, teamId: "nkt", streamer: { platform: "twitch", login: "milva" }, country: "PL", bracket: "high-elo" },
  { gameName: "Aurelien", tagLine: "LOL", region: "EUW", mainRole: "BOTTOM", profileIconId: 604, teamId: "bsl", country: "FR", bracket: "high-elo" },
  { gameName: "Shenzai", tagLine: "EUW", region: "EUW", mainRole: "TOP", profileIconId: 606, teamId: "hlx", streamer: { platform: "kick", login: "shenzai" }, country: "FR", bracket: "high-elo" },
  { gameName: "Perséis", tagLine: "MID", region: "EUW", mainRole: "MIDDLE", profileIconId: 608, teamId: "kra", country: "GR", bracket: "high-elo" },
  { gameName: "Volkov", tagLine: "EUNE", region: "EUNE", mainRole: "JUNGLE", profileIconId: 610, teamId: "obs", country: "RU", bracket: "high-elo" },
  { gameName: "Lysandre", tagLine: "SUP", region: "EUW", mainRole: "UTILITY", profileIconId: 612, teamId: "vlt", streamer: { platform: "twitch", login: "lysandre" }, country: "FR", bracket: "high-elo" },
  { gameName: "Kirin", tagLine: "KR1", region: "KR", mainRole: "MIDDLE", profileIconId: 614, teamId: "nkt", country: "KR", bracket: "high-elo" },
  { gameName: "Malorne", tagLine: "EUW", region: "EUW", mainRole: "TOP", profileIconId: 616, teamId: "bsl", country: "IT", bracket: "high-elo" },
  { gameName: "Ysold", tagLine: "ADC", region: "EUW", mainRole: "BOTTOM", profileIconId: 589, teamId: "hlx", streamer: { platform: "twitch", login: "ysold" }, country: "FR", bracket: "high-elo" },
  { gameName: "Rhadam", tagLine: "JGL", region: "EUW", mainRole: "JUNGLE", profileIconId: 591, teamId: "kra", country: "PT", bracket: "high-elo" },
  { gameName: "Cassien", tagLine: "EUW", region: "EUW", mainRole: "UTILITY", profileIconId: 593, teamId: "obs", country: "FR", bracket: "high-elo" },
  { gameName: "Nihil", tagLine: "000", region: "EUW", mainRole: "MIDDLE", profileIconId: 595, streamer: { platform: "twitch", login: "nihil" }, country: "NL", bracket: "high-elo" },
  { gameName: "Ferrum", tagLine: "TOP", region: "EUW", mainRole: "TOP", profileIconId: 597, country: "CH", bracket: "high-elo" },

  // ── Low elo ───────────────────────────────────────────────────────────────
  { gameName: "Petitpont", tagLine: "EUW", region: "EUW", mainRole: "UTILITY", profileIconId: 599, streamer: { platform: "twitch", login: "petitpont" }, country: "FR", bracket: "low-elo" },
  { gameName: "Grelot", tagLine: "NOOB", region: "EUW", mainRole: "TOP", profileIconId: 601, country: "FR", bracket: "low-elo" },
  { gameName: "Mirabelle", tagLine: "SUP", region: "EUW", mainRole: "UTILITY", profileIconId: 603, streamer: { platform: "kick", login: "mirabelle" }, country: "FR", bracket: "low-elo" },
  { gameName: "Tonton", tagLine: "JGL", region: "EUW", mainRole: "JUNGLE", profileIconId: 605, country: "FR", bracket: "low-elo" },
  { gameName: "Zabou", tagLine: "MID", region: "EUW", mainRole: "MIDDLE", profileIconId: 607, streamer: { platform: "twitch", login: "zabou" }, country: "FR", bracket: "low-elo" },
  { gameName: "Croquette", tagLine: "ADC", region: "EUW", mainRole: "BOTTOM", profileIconId: 609, country: "FR", bracket: "low-elo" },
  { gameName: "Bastienne", tagLine: "EUW", region: "EUW", mainRole: "TOP", profileIconId: 611, country: "FR", bracket: "low-elo" },
  { gameName: "Pixou", tagLine: "AFK", region: "EUW", mainRole: "JUNGLE", profileIconId: 613, streamer: { platform: "twitch", login: "pixou" }, country: "FR", bracket: "low-elo" },
  { gameName: "Marguerite", tagLine: "SUP", region: "EUW", mainRole: "UTILITY", profileIconId: 615, country: "FR", bracket: "low-elo" },
  { gameName: "Jojo", tagLine: "LOL", region: "EUW", mainRole: "MIDDLE", profileIconId: 617, country: "FR", bracket: "low-elo" },
  { gameName: "Sardine", tagLine: "ADC", region: "EUW", mainRole: "BOTTOM", profileIconId: 4568, streamer: { platform: "kick", login: "sardine" }, country: "FR", bracket: "low-elo" },
  { gameName: "Kevinou", tagLine: "EUW", region: "EUW", mainRole: "TOP", profileIconId: 4570, country: "FR", bracket: "low-elo" },
];
