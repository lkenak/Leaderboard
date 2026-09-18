import {
  championKey,
  championKeyFromNumericId,
  championLabel,
} from "@/lib/champions";
import { absoluteLp } from "@/lib/lol";
import * as players from "@/lib/db/riot-players";
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

/**
 * Synchronisation des comptes Riot d'une **portée** : tout le monde, un seul
 * ladder, ou les comptes déclarés par une seule personne.
 *
 * La portée existe parce qu'un relevé global est le mauvais outil pour la
 * plupart des demandes. Faire apparaître un compte qu'on vient d'ajouter
 * demande deux appels ; les faire passer par un cycle complet sur tous les
 * joueurs, c'était attendre des minutes et consommer du quota pour des comptes
 * que personne ne regardait.
 *
 * Quelle que soit la portée, un compte suivi par deux ladders n'est relevé
 * qu'une fois —
 * une seule clé API, un seul quota, donc un compte partagé entre deux ladders
 * n'est résolu et suivi qu'une seule fois (voir `lib/db/riot-players.ts`).
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
const MATCH_PAGE = 20;

/**
 * Au-delà, une partie terminée n'est plus annoncée.
 *
 * Protège du rattrapage après une coupure : au retour du service on
 * enregistre bien les parties manquées, mais on n'inonde pas le salon de
 * comptes rendus de la veille.
 */
const ANNONCE_AGE_MAX_MS = 3 * 3600_000;

export interface SyncReport {
  startedAt: number;
  durationMs: number;
  calls: number;
  accounts: number;
  resolved: number;
  newSamples: number;
  newGames: number;
  /** Parties mises en file pour un compte rendu Discord. */
  queued: number;
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
function fillLpDeltas(puuid: string, samples: players.LpSample[], games: GameRecord[]): number {
  if (samples.length < 2) return 0;
  let filled = 0;

  for (const game of games) {
    if (game.lpDelta !== null) continue;

    let before: players.LpSample | null = null;
    let after: players.LpSample | null = null;
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

    const delta = after.absoluteLp - before.absoluteLp;
    players.setGameLpDelta(puuid, game.id, delta);
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

/* ── Le job ───────────────────────────────────────────────────────────────── */

export async function sync(
  scope: players.SyncScope = { kind: "tout" },
): Promise<SyncReport> {
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
    queued: 0,
    inGame: 0,
    unranked: [],
    errors: [],
  };

  // Un compte retiré de son dernier ladder (ou « mes comptes ») ne doit plus
  // être interrogé — mieux vaut le savoir avant de consommer du quota pour lui.
  // Uniquement sur un relevé global : un compte orphelin n'est pas dans la
  // portée qu'on vient de viser, et le ménage n'a pas à s'inviter dans une
  // synchronisation ciblée.
  if (scope.kind === "tout") players.pruneOrphanPlayers();

  const unresolved = players.listUnresolvedIdentities(scope);
  report.accounts = unresolved.length;

  /* 1 — Riot ID → puuid, une seule fois par identité déclarée. Deux
     déclarations différentes du même compte convergent vers le même
     `riot_players` dès que l'une des deux résout. */
  for (const identity of unresolved) {
    const label = `${identity.gameName}#${identity.tagLine}`;
    try {
      const dto = await accountByRiotId(identity.region, identity.gameName, identity.tagLine);
      if (!dto) {
        const message = `Riot ID introuvable sur ${identity.region}. Vérifier l'orthographe, le tag et la région.`;
        players.markResolveError(identity, message);
        report.errors.push({ account: label, message });
        continue;
      }
      players.resolveIdentity(identity, dto);
      report.resolved++;
    } catch (err) {
      if (err instanceof MissingKeyError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      players.markResolveError(identity, message);
      report.errors.push({ account: label, message });
    }
  }

  const roster = players.listPlayersToSync(scope);
  report.accounts += roster.length;

  for (const account of roster) {
    const label = `${account.gameName}#${account.tagLine}`;
    const id = account.puuid;
    try {
      /* 2 — Icône et niveau : une fois, ça ne bouge quasiment jamais. */
      if (account.profileIconId === null) {
        const summoner = await summonerByPuuid(account.region, id);
        if (summoner) {
          players.patchPlayer(id, {
            profileIconId: summoner.profileIconId,
            summonerLevel: summoner.summonerLevel,
          });
        }
      }

      /* 3 — Le rang. Appel systématique : c'est la donnée du classement. */
      const entry = soloEntry(await leagueEntriesByPuuid(account.region, id));
      if (!entry || !isTier(entry.tier)) {
        report.unranked.push(label);
        players.patchPlayer(id, { lastError: "Aucune partie classée en SoloQ sur ce split." });
        continue;
      }

      const division = DIVISIONS.find((d) => d === entry.rank) ?? null;
      const rank = {
        tier: entry.tier,
        division,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
      };
      const abs = absoluteLp(rank);
      const samples = players.listSamples(id);
      const previous = samples.at(-1) ?? null;
      const moved =
        !previous ||
        previous.absoluteLp !== abs ||
        previous.wins !== entry.wins ||
        previous.losses !== entry.losses;
      const stale = !previous || Date.now() - previous.ts > HEARTBEAT_MS;

      if (moved || stale) {
        players.addSample(id, {
          ts: Date.now(),
          tier: entry.tier,
          division,
          leaguePoints: entry.leaguePoints,
          absoluteLp: abs,
          wins: entry.wins,
          losses: entry.losses,
        });
        report.newSamples++;
      }

      // Le pic est entretenu ici, jamais recalculé : voir lib/db/riot-players.ts.
      players.patchPlayer(id, {
        lastError: null,
        peakAbsoluteLp: Math.max(account.peakAbsoluteLp ?? 0, abs),
      });

      /* 4 — Les parties, seulement si le compteur a bougé. */
      const playedSince =
        !previous || previous.wins + previous.losses !== entry.wins + entry.losses;
      const known = players.listGames(id);
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
          /* Enregistrement et mise en file dans la même transaction : un
             plantage entre les deux perdrait la partie pour toujours, puisque
             au cycle suivant elle ne serait plus « nouvelle ».

             L'événement ne porte **pas** le delta de LP. `fillLpDeltas` tourne
             plus bas et ne l'attribue que si exactement une partie sépare deux
             relevés ; sinon il reste nul, à jamais et à juste titre. Le bot
             lira `games.lp_delta` au moment de poster. */
          report.queued += players.upsertGamesAndEnqueue(id, fresh, {
            // Jamais au premier relevé d'un compte : match-v5 renvoie vingt
            // parties d'un coup, personne ne veut vingt cartes de rattrapage.
            annoncer: known.length > 0,
            ageMaxMs: ANNONCE_AGE_MAX_MS,
            now: startedAt,
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
          role: dominantRole(known) ?? "MIDDLE",
          startedAt: live.gameStartTime,
        };
      }
      if (liveGame) report.inGame++;
      players.setLive(id, liveGame);

      /* 6 — Deltas et rétention, sur l'état à jour de ce compte. */
      const allSamples = players.listSamples(id);
      const allGames = players.listGames(id);
      fillLpDeltas(id, allSamples, allGames);
      players.pruneSamples(id);
      players.pruneGames(id);
    } catch (err) {
      if (err instanceof MissingKeyError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      report.errors.push({ account: label, message });
      players.patchPlayer(id, { lastError: message });
    }
  }

  // `sync_meta` date le relevé **global**, et lui seul. Une synchro ciblée qui
  // l'écrirait ferait croire que tous les comptes viennent d'être relevés, et
  // le relevé global suivant se croirait à jour — les autres joueurs
  // gèleraient sans que rien ne le signale.
  if (scope.kind === "tout") {
    players.setSyncMeta(
      Date.now(),
      report.errors.length > 0 ? `${report.errors.length} compte(s) en erreur` : null,
    );
  }

  report.calls = callsTotal() - callsBefore;
  report.durationMs = Date.now() - startedAt;
  return report;
}
