import { absoluteLp } from "@/lib/lol";
import { reposition } from "@/lib/ranking";
import { winratePct, kda as kdaOf } from "@/lib/format";
import * as store from "@/lib/store";
import type {
  ChampionStat,
  GameRecord,
  Player,
  RankingEntry,
  RankingSnapshot,
  Role,
} from "@/lib/types";
import { PLATFORM } from "./routing";

/**
 * Projette le contenu du stockage sur le modèle que consomment les vues.
 *
 * Aucun appel réseau ici : la synchronisation écrit, cette fonction lit. C'est
 * ce qui permet à la page de répondre en quelques millisecondes et de rester
 * affichable même quand l'API Riot est en panne — on montre alors le dernier
 * relevé connu, daté, plutôt qu'une page d'erreur.
 */

/** Fenêtre d'agrégation : KDA, champions favoris, forme. */
const WINDOW = 26;
const DAY_MS = 24 * 3600_000;
/** En dessous de cette profondeur d'historique, la fenêtre 24 h est annoncée
 *  comme partielle. */
const NEAR_DAY_MS = 20 * 3600_000;

export interface SnapshotMeta {
  source: "riot";
  lastSync: number | null;
  lastSyncError: string | null;
  accounts: number;
  ranked: number;
  /** Comptes présents dans le plateau mais absents du classement, et pourquoi. */
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
function lpCurve(samples: store.LpSample[]): number[] {
  const out: number[] = [];
  for (const sample of samples) {
    if (out.length === 0 || out[out.length - 1] !== sample.absoluteLp) {
      out.push(sample.absoluteLp);
    }
  }
  return out.slice(-40);
}

function sessionOf(
  samples: store.LpSample[],
  games: GameRecord[],
  now: number,
): RankingEntry["session"] {
  const dayAgo = now - DAY_MS;
  const dayGames = games.filter((g) => g.endedAt >= dayAgo);
  const wins = dayGames.filter((g) => g.win).length;
  const losses = dayGames.length - wins;
  const latest = samples.at(-1);

  if (!latest) {
    return { lp: null, wins, losses, games: dayGames.length, partial: true };
  }

  // Cas nominal : un relevé antérieur à la fenêtre sert d'ancre, la variation
  // est alors exacte, y compris pour les parties dont le delta est inconnu.
  let anchor: store.LpSample | undefined;
  for (const sample of samples) {
    if (sample.ts <= dayAgo) anchor = sample;
    else break;
  }
  if (anchor) {
    return {
      lp: latest.absoluteLp - anchor.absoluteLp,
      wins,
      losses,
      games: dayGames.length,
      partial: false,
    };
  }

  // Suivi trop jeune : on additionne les deltas connus, sinon on mesure depuis
  // le premier relevé, et on le signale.
  const known = dayGames.filter((g) => g.lpDelta !== null);
  const oldest = samples[0];
  const lp =
    known.length > 0
      ? known.reduce((a, g) => a + (g.lpDelta ?? 0), 0)
      : oldest && oldest.ts !== latest.ts
        ? latest.absoluteLp - oldest.absoluteLp
        : null;

  return {
    lp,
    wins,
    losses,
    games: dayGames.length,
    partial: !oldest || now - oldest.ts < NEAR_DAY_MS,
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

export async function buildSnapshots(now: number): Promise<{
  snapshots: Record<string, RankingSnapshot>;
  meta: SnapshotMeta;
}> {
  const data = await store.read();
  const splitName = process.env.SPLIT_NAME ?? "SoloQ";
  const splitEndsAt = process.env.SPLIT_ENDS_AT
    ? Date.parse(process.env.SPLIT_ENDS_AT)
    : null;

  const excluded: SnapshotMeta["excluded"] = [];
  const byBracket: Record<string, Array<Omit<RankingEntry, "position" | "positionDelta">>> = {
    "high-elo": [],
    "low-elo": [],
  };

  for (const account of data.roster) {
    const label = `${account.gameName}#${account.tagLine}`;
    if (!account.puuid) {
      excluded.push({ label, reason: account.error ?? "Pas encore synchronisé" });
      continue;
    }
    const samples = data.samples[account.puuid] ?? [];
    const latest = samples.at(-1);
    if (!latest) {
      excluded.push({
        label,
        reason: account.error ?? "Aucun relevé de rang pour l'instant",
      });
      continue;
    }

    const allGames = data.games[account.puuid] ?? [];
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
      puuid: account.puuid,
      slug: slugify(account.gameName, account.tagLine),
      gameName: account.gameName,
      tagLine: account.tagLine,
      region: account.region,
      profileIconId: account.profileIconId ?? 0,
      summonerLevel: account.summonerLevel ?? 0,
      mainRole: account.roleOverride ?? dominantRole(window) ?? "MIDDLE",
      streamer: account.streamer,
      country: account.country,
      team: account.teamName
        ? {
            id: account.teamTag ?? account.teamName,
            name: account.teamName,
            tag: account.teamTag ?? account.teamName.slice(0, 3).toUpperCase(),
          }
        : undefined,
    };

    byBracket[account.bracket].push({
      player,
      bracket: account.bracket,
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
      peakAbsoluteLp: samples.reduce((m, s) => Math.max(m, s.absoluteLp), 0),
      live: data.live[account.puuid] ?? null,
      recentGames: allGames.slice(0, 12),
      lastGameAt: allGames[0]?.endedAt ?? null,
    });
  }

  // Coupe apex : celle de la plateforme la plus représentée dans le plateau.
  const platformCount = new Map<string, number>();
  for (const a of data.roster) {
    const p = PLATFORM[a.region];
    platformCount.set(p, (platformCount.get(p) ?? 0) + 1);
  }
  const mainPlatform = [...platformCount.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const rawCutoff = mainPlatform ? data.cutoffs[mainPlatform] : undefined;
  const cutoff = rawCutoff
    ? { challenger: rawCutoff.challenger, grandmaster: rawCutoff.grandmaster }
    : null;

  const snapshots: Record<string, RankingSnapshot> = {};
  let ranked = 0;
  for (const bracket of ["high-elo", "low-elo"] as const) {
    const entries = reposition(
      byBracket[bracket].map((e) => ({ ...e, position: 0, positionDelta: 0 })),
    );
    ranked += entries.length;
    snapshots[bracket] = {
      bracketId: bracket,
      splitName,
      splitEndsAt: Number.isNaN(splitEndsAt as number) ? null : splitEndsAt,
      updatedAt: data.lastSync ?? now,
      cutoff,
      entries,
    };
  }

  return {
    snapshots,
    meta: {
      source: "riot",
      lastSync: data.lastSync,
      lastSyncError: data.lastSyncError,
      accounts: data.roster.length,
      ranked,
      excluded,
    },
  };
}
