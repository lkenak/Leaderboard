import { ROSTER, TEAMS, type RosterMember } from "@/data/roster";
import { rankFromAbsoluteLp } from "./lol";
import { kda as kdaOf, winratePct } from "./format";
import type {
  ChampionStat,
  GameRecord,
  Player,
  RankSnapshot,
  RankingEntry,
  RankingSnapshot,
  Role,
} from "./types";

/**
 * Jeu de données de démonstration.
 *
 * Deux exigences ont guidé ce fichier :
 *  1. **Déterminisme** — un générateur pseudo-aléatoire à graine fixe, pour que
 *     le classement ne se réordonne pas à chaque rechargement et que le rendu
 *     serveur corresponde à l'hydratation.
 *  2. **Cohérence interne** — les chiffres se déduisent les uns des autres au
 *     lieu d'être tirés séparément : l'historique de LP est reconstruit à
 *     partir des deltas réels des parties, la variation de place est obtenue en
 *     comparant le classement d'aujourd'hui à celui d'hier, le KDA et les
 *     champions favoris sont agrégés depuis les parties. Aucun chiffre affiché
 *     ne contredit un autre — c'est ce qui distingue une maquette crédible
 *     d'un remplissage.
 *
 * `lib/riot/` remplacera ce module en fournissant le même `RankingSnapshot`.
 */

/* ── Générateur ───────────────────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed: number) {
  const r = mulberry32(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(r() * (max - min + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  /** Somme de deux tirages uniformes : distribution centrée, plus crédible. */
  const bell = (min: number, max: number) =>
    min + Math.round(((r() + r()) / 2) * (max - min));
  return { r, int, pick, bell, chance: (p: number) => r() < p };
}

/* ── Viviers de champions par rôle (clés Data Dragon présentes dans /public) ─ */

const POOLS: Record<Role, string[]> = {
  TOP: ["Aatrox", "Camille", "Fiora", "Gnar", "Jax", "KSante", "Malphite", "Mordekaiser", "Ornn", "Renekton", "Riven", "Sett", "Volibear", "Gwen", "Ambessa"],
  JUNGLE: ["Briar", "Ekko", "Elise", "Graves", "Hecarim", "Kayn", "Khazix", "LeeSin", "Nidalee", "Sejuani", "Viego", "Vi", "Warwick", "Rengar", "Belveth"],
  MIDDLE: ["Ahri", "Akali", "Azir", "Hwei", "Irelia", "Orianna", "Qiyana", "Sylas", "Syndra", "Taliyah", "Viktor", "Yasuo", "Yone", "Zed", "Aurora"],
  BOTTOM: ["Aphelios", "Ashe", "Caitlyn", "Ezreal", "Jhin", "Jinx", "Kaisa", "Lucian", "MissFortune", "Samira", "Smolder", "Varus", "Vayne", "Xayah", "Zeri"],
  UTILITY: ["Bard", "Karma", "Leona", "Lulu", "Milio", "Nautilus", "Poppy", "Rakan", "Renata", "Senna", "Seraphine", "Thresh", "Yuumi", "Braum", "Rell"],
};

/** Nom lisible : Data Dragon colle les mots, l'affichage ne doit pas. */
const DISPLAY_NAME: Record<string, string> = {
  KSante: "K'Santé",
  LeeSin: "Lee Sin",
  Khazix: "Kha'Zix",
  Kaisa: "Kai'Sa",
  MissFortune: "Miss Fortune",
  Belveth: "Bel'Veth",
  Renata: "Renata Glasc",
  TwistedFate: "Twisted Fate",
  DrMundo: "Dr. Mundo",
};

function championName(id: string): string {
  return DISPLAY_NAME[id] ?? id;
}

/** Les fichiers de /public/lol/champions n'ont pas d'apostrophe. */
function championFile(id: string): string {
  return id.replace(/['\s.]/g, "");
}

/* ── Profil de LP visé selon la sélection ─────────────────────────────────── */

/**
 * Cible de LP absolus par position dans la sélection. On dessine la courbe du
 * haut de tableau (l'écart entre le 1er et le 5e est grand, celui entre le 15e
 * et le 20e est faible) : c'est la forme réelle d'un ladder.
 */
function lpTarget(
  bracket: "high-elo" | "low-elo",
  i: number,
  total: number,
): number {
  const t = i / Math.max(1, total - 1);
  if (bracket === "high-elo") {
    // Challenger 1 400 LP → Diamant II, décroissance en puissance.
    return Math.round(4200 - 1700 * Math.pow(t, 0.72));
  }
  // Platine IV → Argent III.
  return Math.round(1750 - 800 * Math.pow(t, 0.85));
}

/* ── Construction d'une entrée ────────────────────────────────────────────── */

const GAMES_WINDOW = 26; // parties conservées pour la forme et la courbe

/** Fin du split — date fixe en mode démonstration, sinon le compte à rebours
 *  divergerait entre le rendu serveur et l'hydratation. */
export const SPLIT_ENDS_AT: number | null = Date.UTC(2026, 10, 11, 20, 0, 0);

/** Coupes apex EUW. En production : `GET /apex-cutoff`, rafraîchi toutes les
 *  10 minutes ; ici, deux constantes plausibles. */
const CUTOFF = { challenger: 1042, grandmaster: 613 };

interface BuildContext {
  now: number;
  bracket: "high-elo" | "low-elo";
  index: number;
  total: number;
  liveSlots: Set<number>;
}

function buildEntry(
  member: RosterMember,
  ctx: BuildContext,
): Omit<RankingEntry, "position" | "positionDelta"> {
  // La graine dérive du pseudo : le même joueur garde les mêmes chiffres.
  const seed = [...`${member.gameName}#${member.tagLine}`].reduce(
    (a, c) => (a * 33 + c.charCodeAt(0)) >>> 0,
    7,
  );
  const rng = makeRng(seed);

  const targetLp = lpTarget(ctx.bracket, ctx.index, ctx.total);
  // Un peu de bruit, sinon les LP s'alignent trop régulièrement.
  const currentAbs = Math.max(300, targetLp + rng.int(-28, 28));
  const rank = rankFromAbsoluteLp(currentAbs);

  // Bilan de saison : le volume de parties dépend du palier visé.
  const apex = currentAbs >= 2800;
  const seasonGames = apex ? rng.bell(240, 620) : rng.bell(90, 340);
  const trueWinrate = apex ? 0.5 + rng.r() * 0.08 : 0.44 + rng.r() * 0.14;
  const wins = Math.round(seasonGames * trueWinrate);
  const losses = seasonGames - wins;

  const filled: RankSnapshot = { ...rank, wins, losses };

  /* Parties récentes : tirées dans l'ordre antéchronologique, puis l'historique
     de LP est reconstruit à rebours depuis le LP courant. Les deux ne peuvent
     donc pas se contredire. */
  const games: GameRecord[] = [];
  let cursor = ctx.now - rng.int(4, 90) * 60_000; // dernière partie terminée
  const pool = POOLS[member.mainRole];
  const secondary = POOLS[rng.pick(Object.keys(POOLS) as Role[])];
  const favourites = [rng.pick(pool), rng.pick(pool), rng.pick(secondary)];

  for (let g = 0; g < GAMES_WINDOW; g++) {
    const win = rng.chance(trueWinrate);
    // Les gains se resserrent en apex : ±15 LP en moyenne contre ±22 en dessous.
    const gain = apex ? rng.int(9, 24) : rng.int(15, 27);
    const loss = apex ? rng.int(11, 25) : rng.int(13, 23);
    const championId = rng.chance(0.55)
      ? rng.pick(favourites)
      : rng.pick(rng.chance(0.75) ? pool : secondary);
    const deaths = rng.bell(1, 11);
    const kills = win ? rng.bell(3, 17) : rng.bell(0, 11);
    const assists = member.mainRole === "UTILITY" ? rng.bell(6, 26) : rng.bell(2, 15);
    const durationSec = rng.int(17, 42) * 60 + rng.int(0, 59);

    games.push({
      id: `${seed}-${g}`,
      championId: championFile(championId),
      championName: championName(championId),
      role: rng.chance(0.82) ? member.mainRole : rng.pick(Object.keys(POOLS) as Role[]),
      win,
      kills,
      deaths,
      assists,
      lpDelta: win ? gain : -loss,
      durationSec,
      endedAt: cursor,
      cs: Math.round((durationSec / 60) * (member.mainRole === "UTILITY" ? rng.int(2, 4) : rng.int(6, 10))),
      visionScore: member.mainRole === "UTILITY" ? rng.bell(28, 74) : rng.bell(9, 34),
    });

    // Intervalle entre deux parties : la durée + file d'attente + pauses.
    cursor -= durationSec * 1000 + rng.int(6, 70) * 60_000;
  }

  // Historique de LP : ancien → récent, se termine exactement sur le LP courant.
  const lpHistory: number[] = [];
  let walk = currentAbs;
  for (const g of games) {
    lpHistory.unshift(walk);
    walk = Math.max(200, walk - (g.lpDelta ?? 0));
  }
  lpHistory.unshift(walk);

  // Bilan des 24 dernières heures, calculé sur les parties, pas tiré au hasard.
  const dayAgo = ctx.now - 24 * 3600_000;
  const dayGames = games.filter((g) => g.endedAt >= dayAgo);
  const session = {
    lp: dayGames.reduce((a, g) => a + (g.lpDelta ?? 0), 0),
    wins: dayGames.filter((g) => g.win).length,
    losses: dayGames.filter((g) => !g.win).length,
    games: dayGames.length,
    partial: false,
  };

  const form = games.slice(0, 7).map((g) => g.win);
  let count = 0;
  while (count < games.length && games[count].win === games[0].win) count++;
  const streak: RankingEntry["streak"] =
    count >= 2 ? { type: games[0].win ? "win" : "loss", count } : { type: "none", count: 0 };

  // Champions favoris : agrégés sur la fenêtre, triés par volume puis victoires.
  const byChampion = new Map<string, ChampionStat>();
  for (const g of games) {
    const prev = byChampion.get(g.championId) ?? {
      championId: g.championId,
      championName: g.championName,
      games: 0,
      wins: 0,
      kda: 0,
    };
    prev.games += 1;
    prev.wins += g.win ? 1 : 0;
    prev.kda += kdaOf(g.kills, g.deaths, g.assists);
    byChampion.set(g.championId, prev);
  }
  const champions = [...byChampion.values()]
    .map((c) => ({ ...c, kda: c.kda / c.games }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 3);

  const totals = games.reduce(
    (a, g) => ({ k: a.k + g.kills, d: a.d + g.deaths, a: a.a + g.assists }),
    { k: 0, d: 0, a: 0 },
  );

  const team = TEAMS.find((t) => t.id === member.teamId);
  const player: Player = {
    puuid: `mock-${seed}`,
    slug: `${member.gameName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}-${member.tagLine.toLowerCase()}`,
    gameName: member.gameName,
    tagLine: member.tagLine,
    region: member.region,
    profileIconId: member.profileIconId,
    summonerLevel: rng.int(120, 780),
    mainRole: member.mainRole,
    streamer: member.streamer,
    country: member.country,
    team: team ? { id: team.id, name: team.name, tag: team.tag } : undefined,
  };

  const live = ctx.liveSlots.has(ctx.index)
    ? {
        championId: championFile(rng.pick(favourites)),
        championName: championName(rng.pick(favourites)),
        role: member.mainRole,
        startedAt: ctx.now - rng.int(2, 34) * 60_000 - rng.int(0, 59) * 1000,
      }
    : null;

  return {
    player,
    bracket: ctx.bracket,
    rank: filled,
    absoluteLp: currentAbs,
    session,
    form,
    streak,
    winrate: winratePct(wins, losses),
    games: seasonGames,
    kda: kdaOf(totals.k, totals.d, totals.a),
    champions,
    lpHistory,
    peakAbsoluteLp: Math.max(currentAbs, ...lpHistory) + rng.int(0, 60),
    live,
    recentGames: games.slice(0, 12),
    lastGameAt: games[0].endedAt,
  };
}

/* ── Assemblage du classement ─────────────────────────────────────────────── */

export function buildSnapshot(
  bracket: "high-elo" | "low-elo",
  now: number,
): RankingSnapshot {
  const members = ROSTER.filter((m) => m.bracket === bracket);
  const rng = makeRng(bracket === "high-elo" ? 20260914 : 20260915);

  // Quelques joueurs sont en partie : on fixe lesquels une fois pour toutes.
  const liveSlots = new Set<number>();
  const liveCount = bracket === "high-elo" ? 4 : 2;
  while (liveSlots.size < liveCount) liveSlots.add(rng.int(0, members.length - 1));

  const built = members.map((m, i) =>
    buildEntry(m, { now, bracket, index: i, total: members.length, liveSlots }),
  );

  // Classement du jour : LP absolus, puis victoires de la fenêtre en cas d'égalité.
  const today = [...built].sort(
    (a, b) => b.absoluteLp - a.absoluteLp || b.rank.wins - a.rank.wins,
  );

  /* Classement de la veille : mêmes joueurs, LP d'il y a 24 h. La variation de
     place est donc la vraie différence entre deux classements, pas un nombre
     inventé — un joueur ne peut pas « gagner 3 places » en perdant des LP
     quand personne autour de lui n'en a gagné. */
  const yesterday = [...built]
    .map((e) => ({ puuid: e.player.puuid, lp: e.absoluteLp - (e.session.lp ?? 0) }))
    .sort((a, b) => b.lp - a.lp);
  const yesterdayPosition = new Map(
    yesterday.map((e, i) => [e.puuid, i + 1] as const),
  );

  const entries: RankingEntry[] = today.map((e, i) => ({
    ...e,
    position: i + 1,
    positionDelta: (yesterdayPosition.get(e.player.puuid) ?? i + 1) - (i + 1),
  }));

  return {
    bracketId: bracket,
    splitName: "Split 3 · 2026",
    splitEndsAt: SPLIT_ENDS_AT,
    updatedAt: now,
    cutoff: CUTOFF,
    entries,
  };
}

/** Les deux tableaux d'un coup — la page en a besoin pour basculer sans requête. */
export function buildAllSnapshots(now: number): Record<string, RankingSnapshot> {
  return {
    "high-elo": buildSnapshot("high-elo", now),
    "low-elo": buildSnapshot("low-elo", now),
  };
}
