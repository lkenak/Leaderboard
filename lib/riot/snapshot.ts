import { absoluteLp } from "@/lib/lol";
import { reposition } from "@/lib/ranking";
import { winratePct, kda as kdaOf } from "@/lib/format";
import { listMembers, type LadderMemberRecord } from "@/lib/db/ladders";
import {
  getLive,
  getPlayer,
  getSyncMeta,
  listGames,
  listSamples,
  type LpSample,
} from "@/lib/db/riot-players";
import type {
  ChampionStat,
  GameRecord,
  Player,
  RankingEntry,
  RankingSnapshot,
  Role,
} from "@/lib/types";

/**
 * Projette le contenu de la base sur le modèle que consomme la vue, pour UN
 * ladder donné.
 *
 * Aucun appel réseau ici : la synchronisation écrit, cette fonction lit. C'est
 * ce qui permet à la page de répondre en quelques millisecondes et de rester
 * affichable même quand l'API Riot est en panne — on montre alors le dernier
 * relevé connu, daté, plutôt qu'une page d'erreur.
 */

/** Fenêtre d'agrégation : KDA, champions favoris, forme. */
const WINDOW = 26;
const DAY_MS = 24 * 3600_000;

export interface SnapshotMeta {
  source: "riot";
  lastSync: number | null;
  lastSyncError: string | null;
  accounts: number;
  ranked: number;
  /** Membres présents dans le ladder mais absents du classement, et pourquoi. */
  excluded: Array<{ label: string; reason: string }>;
}

function slugify(gameName: string, tagLine: string): string {
  const base = `${gameName}-${tagLine}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "joueur";
}

/** Courbe de LP : on retire les paliers plats pour ne garder que les marches. */
function lpCurve(samples: LpSample[]): number[] {
  const out: number[] = [];
  for (const sample of samples) {
    if (out.length === 0 || out[out.length - 1] !== sample.absoluteLp) {
      out.push(sample.absoluteLp);
    }
  }
  return out.slice(-40);
}

/**
 * Bilan des dernières 24 h : variation de LP, et victoires/défaites.
 *
 * L'exigence est que **les deux chiffres décrivent les mêmes parties**. Ce
 * n'était pas le cas : la variation se mesurait entre le dernier relevé
 * antérieur à la fenêtre et le relevé courant, comme si ce relevé datait
 * précisément d'il y a 24 h. Rien ne le garantit — la rétention ne conserve
 * que quarante relevés, et le plus récent d'avant la fenêtre peut la précéder
 * de plusieurs heures. Observé en production : une ancre 18,8 h trop tôt,
 * donnant « +80 LP » à côté de « 1V·0D » parce que les trois autres parties
 * du joueur tombaient dans l'intervalle entre l'ancre et la fenêtre.
 *
 * L'ancre reste la meilleure mesure quand elle est utilisable, parce qu'elle
 * reste exacte même pour les parties dont le delta individuel est inconnu.
 * Elle ne l'est qu'à une condition, qui se vérifie directement : **aucune
 * partie ne doit s'être jouée entre l'ancre et l'ouverture de la fenêtre**.
 * Alors tout le mouvement de LP depuis l'ancre est imputable aux parties de
 * la fenêtre, quel que soit l'âge de l'ancre.
 *
 * À défaut, on additionne les variations connues des parties de la fenêtre.
 * Ce total ne peut pas déborder de la période, mais il est incomplet tant que
 * toutes les parties n'ont pas de delta — d'où `partial`, que la cellule
 * traduit par une infobulle.
 */
function sessionOf(
  samples: LpSample[],
  games: GameRecord[],
  now: number,
): RankingEntry["session"] {
  const dayAgo = now - DAY_MS;
  const dayGames = games.filter((g) => g.endedAt >= dayAgo);
  const wins = dayGames.filter((g) => g.win).length;
  const losses = dayGames.length - wins;
  const compte = dayGames.length;
  const latest = samples.at(-1);

  if (!latest) return { lp: null, wins, losses, games: compte, partial: true };

  // Aucune partie dans la fenêtre : la variation est nulle et elle est sûre.
  // Passer par l'ancre ici ferait remonter le mouvement de LP d'une soirée
  // antérieure sur une journée où le joueur n'a pas joué.
  if (compte === 0) return { lp: 0, wins: 0, losses: 0, games: 0, partial: false };

  let anchor: LpSample | undefined;
  for (const sample of samples) {
    if (sample.ts <= dayAgo) anchor = sample;
    else break;
  }

  const ancre = anchor;
  const partieAvantLaFenetre =
    ancre !== undefined &&
    games.some((g) => g.endedAt >= ancre.ts && g.endedAt < dayAgo);

  if (ancre && !partieAvantLaFenetre) {
    return {
      lp: latest.absoluteLp - ancre.absoluteLp,
      wins,
      losses,
      games: compte,
      partial: false,
    };
  }

  const connues = dayGames.filter((g) => g.lpDelta !== null);
  return {
    // Pas de repli sur « depuis le premier relevé » : c'était la même erreur de
    // période que celle qu'on vient de corriger, en pire. Sans aucun delta
    // connu, la variation est inconnue, et `—` le dit honnêtement.
    lp: connues.length > 0 ? connues.reduce((a, g) => a + (g.lpDelta ?? 0), 0) : null,
    wins,
    losses,
    games: compte,
    partial: connues.length < compte,
  };
}

function championsOf(games: GameRecord[]): ChampionStat[] {
  const byChampion = new Map<string, ChampionStat & { kdaSum: number }>();
  for (const g of games) {
    const prev =
      byChampion.get(g.championId) ??
      ({
        championId: g.championId,
        championName: g.championName,
        games: 0,
        wins: 0,
        kda: 0,
        kdaSum: 0,
      } as ChampionStat & { kdaSum: number });
    prev.games += 1;
    prev.wins += g.win ? 1 : 0;
    prev.kdaSum += kdaOf(g.kills, g.deaths, g.assists);
    byChampion.set(g.championId, prev);
  }
  return [...byChampion.values()]
    .map(({ kdaSum, ...c }) => ({ ...c, kda: kdaSum / c.games }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 3);
}

function streakOf(games: GameRecord[]): RankingEntry["streak"] {
  if (games.length === 0) return { type: "none", count: 0 };
  let count = 0;
  while (count < games.length && games[count].win === games[0].win) count++;
  return count >= 2
    ? { type: games[0].win ? "win" : "loss", count }
    : { type: "none", count: 0 };
}

function dominantRole(games: GameRecord[]): Role | undefined {
  if (games.length === 0) return undefined;
  const counts = new Map<Role, number>();
  for (const g of games) counts.set(g.role, (counts.get(g.role) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function labelOf(m: LadderMemberRecord): string {
  return `${m.gameName}#${m.tagLine}`;
}

/** L'identité d'un joueur, indépendamment du ladder qui le référence. */
export interface PlayerIdentity {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: Player["region"];
  roleOverride?: Role;
  country?: string;
}

/**
 * Tout ce qu'on sait d'un compte, sans sa position dans un classement.
 *
 * Extrait de `buildLadderSnapshot` pour être réutilisable : le bot Discord
 * doit pouvoir dresser la fiche d'un joueur qui n'appartient à aucun ladder —
 * un compte déclaré dans « mes comptes » est relevé par la synchro même hors
 * ladder (`listPlayersToSync` fait l'union des deux).
 *
 * Renvoie `null` avec une raison lisible plutôt que de lever : un compte pas
 * encore relevé est un cas normal, pas une erreur.
 */
export function buildPlayerEntry(
  identity: PlayerIdentity,
  now: number,
): { entry: Omit<RankingEntry, "position" | "positionDelta"> } | { raison: string } {
  const account = getPlayer(identity.puuid);
  const samples = listSamples(identity.puuid);
  const latest = samples.at(-1);
  if (!account || !latest) {
    return { raison: account?.lastError ?? "Aucun relevé de rang pour l'instant" };
  }

  const allGames = listGames(identity.puuid);
  const window = allGames.slice(0, WINDOW);
  const rank = {
    tier: latest.tier,
    division: latest.division,
    leaguePoints: latest.leaguePoints,
    wins: latest.wins,
    losses: latest.losses,
  };
  const totals = window.reduce(
    (a, g) => ({ k: a.k + g.kills, d: a.d + g.deaths, a: a.a + g.assists }),
    { k: 0, d: 0, a: 0 },
  );

  const player: Player = {
    puuid: identity.puuid,
    slug: slugify(identity.gameName, identity.tagLine),
    gameName: identity.gameName,
    tagLine: identity.tagLine,
    region: identity.region,
    profileIconId: account.profileIconId ?? 0,
    summonerLevel: account.summonerLevel ?? 0,
    mainRole: identity.roleOverride ?? dominantRole(window) ?? "MIDDLE",
    country: identity.country,
  };

  return {
    entry: {
      player,
      rank,
      absoluteLp: absoluteLp(rank),
      session: sessionOf(samples, allGames, now),
      form: window.slice(0, 7).map((g) => g.win),
      streak: streakOf(window),
      winrate: winratePct(rank.wins, rank.losses),
      games: rank.wins + rank.losses,
      kda: kdaOf(totals.k, totals.d, totals.a),
      champions: championsOf(window),
      lpHistory: lpCurve(samples),
      // Le pic persisté fait autorité ; les relevés ne servent que de repli
      // pour un compte suivi avant l'introduction du champ.
      peakAbsoluteLp: Math.max(
        account.peakAbsoluteLp ?? 0,
        samples.reduce((m, s) => Math.max(m, s.absoluteLp), 0),
      ),
      live: getLive(identity.puuid),
      recentGames: allGames.slice(0, 12),
      lastGameAt: allGames[0]?.endedAt ?? null,
    },
  };
}

export function buildLadderSnapshot(
  ladderId: string,
  now: number,
): { snapshot: RankingSnapshot; meta: SnapshotMeta } {
  const members = listMembers(ladderId);
  const splitName = process.env.SPLIT_NAME ?? "SoloQ";
  const splitEndsAt = process.env.SPLIT_ENDS_AT
    ? Date.parse(process.env.SPLIT_ENDS_AT)
    : null;

  const excluded: SnapshotMeta["excluded"] = [];
  const built: Array<Omit<RankingEntry, "position" | "positionDelta">> = [];

  for (const member of members) {
    const label = labelOf(member);
    if (!member.puuid) {
      excluded.push({ label, reason: member.resolveError ?? "Pas encore synchronisé" });
      continue;
    }

    const resultat = buildPlayerEntry(
      {
        puuid: member.puuid,
        gameName: member.gameName,
        tagLine: member.tagLine,
        region: member.region,
        roleOverride: member.roleOverride,
        country: member.country,
      },
      now,
    );

    if ("raison" in resultat) {
      excluded.push({ label, reason: resultat.raison });
      continue;
    }
    built.push(resultat.entry);
  }

  const { lastSync, lastSyncError } = getSyncMeta();
  const entries = reposition(built.map((e) => ({ ...e, position: 0, positionDelta: 0 })));

  return {
    snapshot: {
      splitName,
      splitEndsAt: Number.isNaN(splitEndsAt as number) ? null : splitEndsAt,
      updatedAt: lastSync ?? now,
      entries,
    },
    meta: {
      source: "riot",
      lastSync,
      lastSyncError,
      accounts: members.length,
      ranked: entries.length,
      excluded,
    },
  };
}
