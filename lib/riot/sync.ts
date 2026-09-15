import {
  championKey,
  championKeyFromNumericId,
  championLabel,
} from "@/lib/champions";
import { absoluteLp } from "@/lib/lol";
import * as store from "@/lib/store";
import type { GameRecord, LiveGame, Role, Tier } from "@/lib/types";
import { DIVISIONS, ROLES, TIERS } from "@/lib/types";
import {
  MissingKeyError,
  accountByRiotId,
  activeGame,
  callsTotal,
  leagueEntriesByPuuid,
  match,
  rankedMatchIds,
  summonerByPuuid,
  type LeagueEntryDto,
  type MatchDto,
} from "./client";
import { PLATFORM, platformHost } from "./routing";

/**
 * Synchronisation du plateau avec l'API Riot.
 *
 * Toute la parcimonie du job est là : sur un cycle courant, seuls deux appels
 * par joueur sont systématiques (le rang et l'état « en partie »). L'historique
 * des parties n'est demandé que lorsque `wins + losses` a bougé depuis le
 * dernier relevé — autrement dit lorsque le joueur a réellement joué. Sans ce
 * garde-fou, un plateau de 32 joueurs consommerait 900 appels par cycle et
 * saturerait le quota d'une clé personnelle en quelques minutes.
 */

const SOLO_QUEUE = "RANKED_SOLO_5x5";
const RANKED_SOLO_QUEUE_ID = 420;

/** Un relevé au moins toutes les 30 min, même sans partie : la fenêtre de 24 h
 *  a besoin d'un point d'ancrage à son extrémité. */
const HEARTBEAT_MS = 30 * 60_000;
const CUTOFF_TTL_MS = 10 * 60_000;
const MATCH_PAGE = 20;

export interface SyncReport {
  startedAt: number;
  durationMs: number;
  calls: number;
  accounts: number;
  resolved: number;
  newSamples: number;
  newGames: number;
  inGame: number;
  unranked: string[];
  errors: Array<{ account: string; message: string }>;
}

function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

function toRole(teamPosition: string, individualPosition: string): Role {
  const raw = (teamPosition || individualPosition || "").toUpperCase();
  return (ROLES as readonly string[]).includes(raw) ? (raw as Role) : "MIDDLE";
}

/**
 * `gameDuration` change d'unité selon les patchs : en secondes dès que
 * `gameEndTimestamp` est présent, en millisecondes avant. Riot documente la
 * bascule, et s'y fier évite d'afficher des parties de 37 000 minutes.
 */
function durationSeconds(info: MatchDto["info"]): number {
  return info.gameEndTimestamp !== undefined
    ? info.gameDuration
    : Math.round(info.gameDuration / 1000);
}

function toGameRecord(dto: MatchDto, puuid: string): GameRecord | null {
  const me = dto.info.participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  // Les parties refaites ne comptent ni en victoire ni en défaite côté Riot :
  // les garder faussecrait la forme et le winrate.
  if (me.gameEndedInEarlySurrender) return null;

  const seconds = durationSeconds(dto.info);
  return {
    id: dto.metadata.matchId,
    championId: championKey(me.championName),
    championName: championLabel(me.championName),
    role: toRole(me.teamPosition, me.individualPosition),
    win: me.win,
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    lpDelta: null, // rempli plus tard, par encadrement de relevés
    durationSec: seconds,
    endedAt: dto.info.gameEndTimestamp ?? dto.info.gameStartTimestamp + seconds * 1000,
    cs: me.totalMinionsKilled + me.neutralMinionsKilled,
    visionScore: me.visionScore,
  };
}

function soloEntry(entries: LeagueEntryDto[] | null): LeagueEntryDto | null {
  return entries?.find((e) => e.queueType === SOLO_QUEUE) ?? null;
}

/**
 * Attribue à chaque partie le delta de LP déduit des relevés qui l'encadrent.
 *
 * On ne retient un delta que si le relevé *précédent* la partie et le relevé
 * *suivant* ne sont séparés que par cette seule partie (`wins + losses`
 * n'a progressé que de 1). Sinon deux parties jouées entre deux relevés se
 * verraient attribuer le même total, ce qui est faux pour les deux.
 */
function fillLpDeltas(samples: store.LpSample[], games: GameRecord[]): number {
  if (samples.length < 2) return 0;
  let filled = 0;

  for (const game of games) {
    if (game.lpDelta !== null) continue;

    let before: store.LpSample | null = null;
    let after: store.LpSample | null = null;
    for (const sample of samples) {
      if (sample.ts <= game.endedAt) before = sample;
      else {
        after = sample;
        break;
      }
    }
    if (!before || !after) continue;

    const played = after.wins + after.losses - (before.wins + before.losses);
    if (played !== 1) continue;

    game.lpDelta = after.absoluteLp - before.absoluteLp;
    filled++;
  }
  return filled;
}

/** Poste principal : le plus joué sur la fenêtre conservée. */
function dominantRole(games: GameRecord[]): Role | undefined {
  if (games.length === 0) return undefined;
  const counts = new Map<Role, number>();
  for (const g of games) counts.set(g.role, (counts.get(g.role) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* ── Coupes apex ──────────────────────────────────────────────────────────── */

async function refreshCutoff(
  region: store.RosterAccount["region"],
  existing: store.ApexCutoff | undefined,
): Promise<store.ApexCutoff | null> {
  if (existing && Date.now() - existing.fetchedAt < CUTOFF_TTL_MS) return null;

  const key = process.env.RIOT_API_KEY;
  if (!key) throw new MissingKeyError();

  /** La liste complète d'un palier apex ; on n'en garde que le LP minimum. */
  const minLp = async (league: "challengerleagues" | "grandmasterleagues") => {
    const res = await fetch(
      `${platformHost(region)}/lol/league/v4/${league}/by-queue/${SOLO_QUEUE}`,
      { headers: { "X-Riot-Token": key }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { entries: Array<{ leaguePoints: number }> };
    if (!body.entries?.length) return null;
    return body.entries.reduce((min, e) => Math.min(min, e.leaguePoints), Infinity);
  };

  const [challenger, grandmaster] = await Promise.all([
    minLp("challengerleagues"),
    minLp("grandmasterleagues"),
  ]);
  if (challenger === null || grandmaster === null) return null;
  return { challenger, grandmaster, fetchedAt: Date.now() };
}

/* ── Le job ───────────────────────────────────────────────────────────────── */

export async function sync(): Promise<SyncReport> {
  const startedAt = Date.now();
  const callsBefore = callsTotal();
  const report: SyncReport = {
    startedAt,
    durationMs: 0,
    calls: 0,
    accounts: 0,
    resolved: 0,
    newSamples: 0,
    newGames: 0,
    inGame: 0,
    unranked: [],
    errors: [],
  };

  const snapshot = await store.read();
  report.accounts = snapshot.roster.length;

  // On travaille sur une copie hors verrou : les appels réseau prennent des
  // secondes, garder le fichier verrouillé pendant ce temps bloquerait l'ajout
  // d'un compte depuis /admin.
  const patches: Array<(s: store.StoreShape) => void> = [];

  for (const account of snapshot.roster) {
    const label = `${account.gameName}#${account.tagLine}`;
    try {
      /* 1 — Riot ID → puuid, une seule fois dans la vie du compte. */
      let puuid = account.puuid;
      if (!puuid) {
        const dto = await accountByRiotId(
          account.region,
          account.gameName,
          account.tagLine,
        );
        if (!dto) {
          const message = `Riot ID introuvable sur ${account.region}. Vérifier l'orthographe, le tag et la région.`;
          patches.push((s) => {
            const a = s.roster.find((x) => x.id === account.id);
            if (a) a.error = message;
          });
          report.errors.push({ account: label, message });
          continue;
        }
        puuid = dto.puuid;
        report.resolved++;
        // Riot renvoie l'orthographe exacte : on s'aligne dessus.
        patches.push((s) => {
          const a = s.roster.find((x) => x.id === account.id);
          if (a) {
            a.puuid = dto.puuid;
            a.gameName = dto.gameName;
            a.tagLine = dto.tagLine;
            a.error = undefined;
          }
        });
      }
      const id = puuid;

      /* 2 — Icône et niveau : une fois, ça ne bouge quasiment jamais. */
      if (account.profileIconId === undefined) {
        const summoner = await summonerByPuuid(account.region, id);
        if (summoner) {
          patches.push((s) => {
            const a = s.roster.find((x) => x.id === account.id);
            if (a) {
              a.profileIconId = summoner.profileIconId;
              a.summonerLevel = summoner.summonerLevel;
            }
          });
        }
      }

      /* 3 — Le rang. Appel systématique : c'est la donnée du classement. */
      const entry = soloEntry(await leagueEntriesByPuuid(account.region, id));
      if (!entry || !isTier(entry.tier)) {
        report.unranked.push(label);
        patches.push((s) => {
          const a = s.roster.find((x) => x.id === account.id);
          if (a) a.error = "Aucune partie classée en SoloQ sur ce split.";
        });
        continue;
      }

      const division =
        DIVISIONS.find((d) => d === entry.rank) ?? null;
      const rank = {
        tier: entry.tier,
        division,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
      };
      const abs = absoluteLp(rank);
      const previous = snapshot.samples[id]?.at(-1);
      const moved =
        !previous ||
        previous.absoluteLp !== abs ||
        previous.wins !== entry.wins ||
        previous.losses !== entry.losses;
      const stale = !previous || Date.now() - previous.ts > HEARTBEAT_MS;

      if (moved || stale) {
        const sample: store.LpSample = {
          ts: Date.now(),
          tier: entry.tier,
          division,
          leaguePoints: entry.leaguePoints,
          absoluteLp: abs,
          wins: entry.wins,
          losses: entry.losses,
        };
        patches.push((s) => {
          (s.samples[id] ??= []).push(sample);
        });
        report.newSamples++;
      }

      patches.push((s) => {
        const a = s.roster.find((x) => x.id === account.id);
        if (!a) return;
        a.error = undefined;
        // Le pic est entretenu ici, jamais recalculé : voir store.ts.
        a.peakAbsoluteLp = Math.max(a.peakAbsoluteLp ?? 0, abs);
      });

      /* 4 — Les parties, seulement si le compteur a bougé. */
      const playedSince =
        !previous || previous.wins + previous.losses !== entry.wins + entry.losses;
      const known = snapshot.games[id] ?? [];
      if (playedSince || known.length === 0) {
        const ids = (await rankedMatchIds(account.region, id, MATCH_PAGE)) ?? [];
        const knownIds = new Set(known.map((g) => g.id));
        const fresh: GameRecord[] = [];
        for (const matchId of ids) {
          if (knownIds.has(matchId)) continue;
          const dto = await match(account.region, matchId);
          if (!dto || dto.info.queueId !== RANKED_SOLO_QUEUE_ID) continue;
          const record = toGameRecord(dto, id);
          if (record) fresh.push(record);
        }
        if (fresh.length > 0) {
          report.newGames += fresh.length;
          patches.push((s) => {
            const merged = [...fresh, ...(s.games[id] ?? [])];
            const seen = new Set<string>();
            s.games[id] = merged
              .filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)))
              .sort((a, b) => b.endedAt - a.endedAt);
          });
        }
      }

      /* 5 — En partie ? 404 attendu et fréquent, ce n'est pas une erreur. */
      const live = await activeGame(account.region, id);
      let liveGame: LiveGame | null = null;
      if (live && live.gameQueueConfigId === RANKED_SOLO_QUEUE_ID) {
        // spectator-v5 ne donne que l'identifiant numérique du champion.
        const numeric = live.participants.find((p) => p.puuid === id)?.championId;
        const key = numeric !== undefined ? championKeyFromNumericId(numeric) : null;
        liveGame = {
          championId: key ?? "",
          championName: key ? championLabel(key) : "champion inconnu",
          role: account.roleOverride ?? dominantRole(known) ?? "MIDDLE",
          startedAt: live.gameStartTime,
        };
      }
      if (liveGame) report.inGame++;
      patches.push((s) => {
        s.live[id] = liveGame;
      });
    } catch (err) {
      if (err instanceof MissingKeyError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      report.errors.push({ account: label, message });
      patches.push((s) => {
        const a = s.roster.find((x) => x.id === account.id);
        if (a) a.error = message;
      });
    }
  }

  /* 6 — Coupes apex, une fois par plateforme représentée dans le plateau. */
  const platforms = new Map<string, store.RosterAccount["region"]>();
  for (const a of snapshot.roster) platforms.set(PLATFORM[a.region], a.region);
  for (const [platform, region] of platforms) {
    try {
      const cutoff = await refreshCutoff(region, snapshot.cutoffs[platform]);
      if (cutoff) patches.push((s) => void (s.cutoffs[platform] = cutoff));
    } catch {
      // Une coupe indisponible masque le widget, elle n'invalide pas la synchro.
    }
  }

  await store.update((s) => {
    for (const patch of patches) patch(s);
    // Les deltas se remplissent à mesure que les relevés s'accumulent : on
    // repasse sur tout l'historique à chaque synchronisation.
    for (const [puuid, games] of Object.entries(s.games)) {
      fillLpDeltas(s.samples[puuid] ?? [], games);
    }
    store.prune(s);
    s.lastSync = Date.now();
    s.lastSyncError =
      report.errors.length > 0
        ? `${report.errors.length} compte(s) en erreur`
        : null;
  });

  report.calls = callsTotal() - callsBefore;
  report.durationMs = Date.now() - startedAt;
  return report;
}
