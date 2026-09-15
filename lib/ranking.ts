import type { RankingEntry, Role } from "./types";

/* ── Tri ──────────────────────────────────────────────────────────────────── */

export type SortKey =
  | "position"
  | "name"
  | "role"
  | "elo"
  | "winrate"
  | "net"
  | "games"
  | "session"
  | "lp"
  | "kda";

export type SortDir = "asc" | "desc";

/** Sens par défaut : croissant pour ce qui se lit comme un rang ou un nom. */
export function defaultDir(key: SortKey): SortDir {
  return key === "position" || key === "name" || key === "role" ? "asc" : "desc";
}

const ROLE_ORDER: Record<Role, number> = {
  TOP: 0,
  JUNGLE: 1,
  MIDDLE: 2,
  BOTTOM: 3,
  UTILITY: 4,
};

/**
 * Moyennes de LP gagnés / perdus sur la fenêtre de parties récentes. Les
 * parties dont le delta est inconnu sont écartées du calcul plutôt que comptées
 * pour zéro, qui tirerait la moyenne vers le bas sans raison.
 */
export function lpAverages(entry: RankingEntry): { win: number; loss: number } {
  const known = entry.recentGames.filter(
    (g): g is typeof g & { lpDelta: number } => g.lpDelta !== null,
  );
  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  return {
    win: avg(known.filter((g) => g.win).map((g) => g.lpDelta)),
    loss: avg(known.filter((g) => !g.win).map((g) => g.lpDelta)),
  };
}

function value(entry: RankingEntry, key: SortKey): number | string {
  switch (key) {
    case "position":
      return entry.position;
    case "name":
      return entry.player.gameName.toLocaleLowerCase("fr");
    case "role":
      return ROLE_ORDER[entry.player.mainRole];
    case "elo":
      return entry.absoluteLp;
    case "winrate":
      return entry.winrate;
    case "net":
      return entry.rank.wins - entry.rank.losses;
    case "games":
      return entry.games;
    case "session":
      // Une variation inconnue se classe comme une absence de mouvement.
      return entry.session.lp ?? 0;
    case "lp":
      return lpAverages(entry).win;
    case "kda":
      return entry.kda;
  }
}

/**
 * Ordre du classement. Deux invariants avant le comparateur de colonne :
 * les joueurs sans partie sur la fenêtre passent après les autres, et
 * l'égalité est toujours tranchée par la place — sans quoi un tri par winrate
 * renverrait un ordre instable d'un rendu à l'autre.
 */
export function sortEntries(
  entries: RankingEntry[],
  key: SortKey,
  dir: SortDir,
): RankingEntry[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const aPlayed = a.rank.wins + a.rank.losses > 0;
    const bPlayed = b.rank.wins + b.rank.losses > 0;
    if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;

    const av = value(a, key);
    const bv = value(b, key);
    const cmp =
      typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv, "fr")
        : (av as number) - (bv as number);
    if (cmp !== 0) return cmp * sign;
    return a.position - b.position;
  });
}

/* ── Filtres ──────────────────────────────────────────────────────────────── */

export interface Filters {
  query: string;
  roles: Role[];
  country: string | null;
  inGameOnly: boolean;
  favouritesOnly: boolean;
  favourites: string[];
}

export function matchesFilters(entry: RankingEntry, f: Filters): boolean {
  if (f.inGameOnly && !entry.live) return false;
  if (f.favouritesOnly && !f.favourites.includes(entry.player.puuid)) return false;
  if (f.roles.length > 0 && !f.roles.includes(entry.player.mainRole)) return false;
  if (f.country && entry.player.country !== f.country) return false;

  const q = f.query.trim().toLocaleLowerCase("fr");
  if (q.length === 0) return true;

  const p = entry.player;
  const haystacks = [p.gameName, `${p.gameName}#${p.tagLine}`];
  return haystacks.some((h) => h.toLocaleLowerCase("fr").includes(q));
}

/** Répartition par pays, pour le menu de filtre — comptes décroissants. */
export function countryCounts(
  entries: RankingEntry[],
): Array<{ code: string; count: number }> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const c = e.player.country;
    if (!c) continue;
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/* ── Places et variations ─────────────────────────────────────────────────── */

/**
 * Recalcule places et variations pour l'ensemble des membres d'un ladder. La
 * variation reste une vraie différence entre deux classements (celui
 * d'aujourd'hui et celui obtenu en retirant les LP des 24 h), et non un champ
 * recopié d'ailleurs.
 */
export function reposition(entries: RankingEntry[]): RankingEntry[] {
  const today = [...entries].sort(
    (a, b) => b.absoluteLp - a.absoluteLp || b.rank.wins - a.rank.wins,
  );
  const yesterday = [...entries]
    .map((e) => ({ puuid: e.player.puuid, lp: e.absoluteLp - (e.session.lp ?? 0) }))
    .sort((a, b) => b.lp - a.lp);
  const before = new Map(yesterday.map((e, i) => [e.puuid, i + 1] as const));

  return today.map((e, i) => ({
    ...e,
    position: i + 1,
    positionDelta: (before.get(e.player.puuid) ?? i + 1) - (i + 1),
  }));
}
