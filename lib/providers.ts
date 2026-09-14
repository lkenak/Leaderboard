/**
 * Sites de statistiques externes. Le classement donne le rang ; pour le détail
 * d'un compte on renvoie vers l'outil que l'utilisateur a choisi, comme le fait
 * le site de référence. Le choix est mémorisé dans le navigateur.
 */
export interface StatsProvider {
  key: string;
  label: string;
  short: string;
  url: (name: string, tag: string, region: string) => string;
}

const PLATFORM: Record<string, string> = {
  EUW: "euw",
  EUNE: "eune",
  NA: "na",
  KR: "kr",
  BR: "br",
  LAN: "lan",
  TR: "tr",
};

const RIOT_PLATFORM: Record<string, string> = {
  EUW: "euw1",
  EUNE: "eun1",
  NA: "na1",
  KR: "kr",
  BR: "br1",
  LAN: "la1",
  TR: "tr1",
};

export const PROVIDERS: StatsProvider[] = [
  {
    key: "opgg",
    label: "OP.GG",
    short: "OP.GG",
    url: (n, t, r) =>
      `https://op.gg/lol/summoners/${PLATFORM[r] ?? "euw"}/${encodeURIComponent(n)}-${encodeURIComponent(t)}`,
  },
  {
    key: "ugg",
    label: "U.GG",
    short: "U.GG",
    url: (n, t, r) =>
      `https://u.gg/lol/profile/${RIOT_PLATFORM[r] ?? "euw1"}/${encodeURIComponent(n)}-${encodeURIComponent(t)}/overview`,
  },
  {
    key: "deeplol",
    label: "DeepLoL",
    short: "DLOL",
    url: (n, t, r) =>
      `https://www.deeplol.gg/summoner/${PLATFORM[r] ?? "euw"}/${encodeURIComponent(n)}-${encodeURIComponent(t)}`,
  },
  {
    key: "log",
    label: "LeagueOfGraphs",
    short: "LOG",
    url: (n, t, r) =>
      `https://www.leagueofgraphs.com/summoner/${PLATFORM[r] ?? "euw"}/${encodeURIComponent(n)}-${encodeURIComponent(t)}`,
  },
];

export const DEFAULT_PROVIDER = PROVIDERS[0];

export function findProvider(key: string | null): StatsProvider {
  return PROVIDERS.find((p) => p.key === key) ?? DEFAULT_PROVIDER;
}
