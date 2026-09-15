import type { Region } from "@/lib/types";

/**
 * L'API Riot a deux familles d'hôtes et il faut prendre la bonne, sinon on
 * récolte un 404 qui ressemble à « compte introuvable » :
 *
 *  — régionale (`europe`, `americas`, `asia`) : account-v1 et match-v5,
 *  — plateforme (`euw1`, `na1`, `kr`…)        : summoner-v4, league-v4,
 *                                               spectator-v5.
 */
export const PLATFORM: Record<Region, string> = {
  EUW: "euw1",
  EUNE: "eun1",
  NA: "na1",
  KR: "kr",
  BR: "br1",
  LAN: "la1",
  TR: "tr1",
};

const CLUSTER: Record<Region, string> = {
  EUW: "europe",
  EUNE: "europe",
  TR: "europe",
  NA: "americas",
  BR: "americas",
  LAN: "americas",
  KR: "asia",
};

export function platformHost(region: Region): string {
  return `https://${PLATFORM[region]}.api.riotgames.com`;
}

export function clusterHost(region: Region): string {
  return `https://${CLUSTER[region]}.api.riotgames.com`;
}

export const REGIONS = Object.keys(PLATFORM) as Region[];
