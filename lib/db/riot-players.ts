import type { Division, GameRecord, LiveGame, Region, Role, Tier } from "@/lib/types";
import { downsampleSamples, MAX_GAMES, type RetentionSample } from "@/lib/riot/retention";
import { getDb } from "./client";

export interface RiotPlayerRecord {
  puuid: string;
  region: Region;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  peakAbsoluteLp: number;
  lastError: string | null;
  updatedAt: number;
}

interface PlayerRow {
  puuid: string;
  region: string;
  game_name: string;
  tag_line: string;
  profile_icon_id: number | null;
  summoner_level: number | null;
  peak_absolute_lp: number;
  last_error: string | null;
  updated_at: number;
}

function playerFromRow(row: PlayerRow): RiotPlayerRecord {
  return {
    puuid: row.puuid,
    region: row.region as Region,
    gameName: row.game_name,
    tagLine: row.tag_line,
    profileIconId: row.profile_icon_id,
    summonerLevel: row.summoner_level,
    peakAbsoluteLp: row.peak_absolute_lp,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

/* ── Identités non résolues ───────────────────────────────────────────────── */

export interface UnresolvedIdentity {
  region: Region;
  gameName: string;
  tagLine: string;
}

/** Union dédupliquée des identités sans puuid — sur `ladder_members` ET
 *  `user_riot_accounts`, sinon un compte « mien » jamais ajouté à un ladder ne
 *  serait jamais résolu et n'apparaîtrait jamais dans la découverte croisée. */
/**
 * Sur quoi porte une synchronisation.
 *
 * Le relevé était global et uniquement global : pour faire apparaître un
 * compte qu'on venait d'ajouter, il fallait attendre qu'un cycle complet
 * passe sur tous les joueurs de toutes les listes. Pouvoir viser un seul
 * ladder — ou les comptes d'une seule personne — rend le relevé immédiat là
 * où on le demande, et évite de consommer du quota pour les autres.
 */
export type SyncScope =
  | { kind: "tout" }
  | { kind: "ladder"; ladderId: string }
  | { kind: "utilisateur"; userId: string };

export function listUnresolvedIdentities(
  scope: SyncScope = { kind: "tout" },
): UnresolvedIdentity[] {
  const db = getDb();
  let rows: Array<{ region: string; game_name: string; tag_line: string }>;

  if (scope.kind === "ladder") {
    rows = db
      .prepare(
        `SELECT DISTINCT region, game_name, tag_line FROM ladder_members
          WHERE ladder_id = ? AND puuid IS NULL`,
      )
      .all(scope.ladderId) as typeof rows;
  } else if (scope.kind === "utilisateur") {
    rows = db
      .prepare(
        `SELECT DISTINCT region, game_name, tag_line FROM user_riot_accounts
          WHERE user_id = ? AND puuid IS NULL`,
      )
      .all(scope.userId) as typeof rows;
  } else {
    rows = db
      .prepare(
        `SELECT DISTINCT region, game_name, tag_line FROM (
           SELECT region, game_name, tag_line FROM ladder_members WHERE puuid IS NULL
           UNION
           SELECT region, game_name, tag_line FROM user_riot_accounts WHERE puuid IS NULL
         )`,
      )
      .all() as typeof rows;
  }

  return rows.map((r) => ({ region: r.region as Region, gameName: r.game_name, tagLine: r.tag_line }));
}

export function markResolveError(identity: UnresolvedIdentity, message: string): void {
  const db = getDb();
  const params = [message, identity.region, identity.gameName, identity.tagLine];
  db.prepare(
    `UPDATE ladder_members SET resolve_error = ?
     WHERE puuid IS NULL AND region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE`,
  ).run(...params);
  db.prepare(
    `UPDATE user_riot_accounts SET resolve_error = ?
     WHERE puuid IS NULL AND region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE`,
  ).run(...params);
}

/**
 * Résout une identité vers un puuid : crée `riot_players` s'il n'existe pas
 * déjà (deux orthographes différentes peuvent converger vers le même puuid,
 * déjà connu par ailleurs), puis rattache toutes les lignes en attente qui
 * correspondaient à cette identité — c'est le mécanisme de dédoublonnage.
 */
export function resolveIdentity(
  identity: UnresolvedIdentity,
  resolved: { puuid: string; gameName: string; tagLine: string },
): void {
  const db = getDb();
  const now = Date.now();

  db.prepare(
    `INSERT INTO riot_players (puuid, region, game_name, tag_line, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(puuid) DO UPDATE SET game_name = excluded.game_name, tag_line = excluded.tag_line`,
  ).run(resolved.puuid, identity.region, resolved.gameName, resolved.tagLine, now);

  const params = [
    resolved.puuid,
    resolved.gameName,
    resolved.tagLine,
    identity.region,
    identity.gameName,
    identity.tagLine,
  ];
  db.prepare(
    `UPDATE ladder_members SET puuid = ?, game_name = ?, tag_line = ?, resolve_error = NULL
     WHERE puuid IS NULL AND region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE`,
  ).run(...params);
  db.prepare(
    `UPDATE user_riot_accounts SET puuid = ?, game_name = ?, tag_line = ?, resolve_error = NULL
     WHERE puuid IS NULL AND region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE`,
  ).run(...params);
}

/* ── Joueurs résolus (référencés par au moins un ladder ou une déclaration) ─ */

export function listPlayersToSync(scope: SyncScope = { kind: "tout" }): RiotPlayerRecord[] {
  const db = getDb();
  let rows: PlayerRow[];

  if (scope.kind === "ladder") {
    rows = db
      .prepare(
        `SELECT * FROM riot_players rp WHERE EXISTS (
           SELECT 1 FROM ladder_members lm WHERE lm.puuid = rp.puuid AND lm.ladder_id = ?)`,
      )
      .all(scope.ladderId) as PlayerRow[];
  } else if (scope.kind === "utilisateur") {
    rows = db
      .prepare(
        `SELECT * FROM riot_players rp WHERE EXISTS (
           SELECT 1 FROM user_riot_accounts ura WHERE ura.puuid = rp.puuid AND ura.user_id = ?)`,
      )
      .all(scope.userId) as PlayerRow[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM riot_players rp WHERE
           EXISTS (SELECT 1 FROM ladder_members lm WHERE lm.puuid = rp.puuid)
           OR EXISTS (SELECT 1 FROM user_riot_accounts ura WHERE ura.puuid = rp.puuid)`,
      )
      .all() as PlayerRow[];
  }

  return rows.map(playerFromRow);
}

export function getPlayer(puuid: string): RiotPlayerRecord | null {
  const row = getDb().prepare<[string], PlayerRow>("SELECT * FROM riot_players WHERE puuid = ?").get(puuid);
  return row ? playerFromRow(row) : null;
}

export function patchPlayer(
  puuid: string,
  patch: Partial<Pick<RiotPlayerRecord, "profileIconId" | "summonerLevel" | "peakAbsoluteLp" | "lastError">>,
): void {
  const db = getDb();
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [Date.now()];
  if (patch.profileIconId !== undefined) { sets.push("profile_icon_id = ?"); values.push(patch.profileIconId); }
  if (patch.summonerLevel !== undefined) { sets.push("summoner_level = ?"); values.push(patch.summonerLevel); }
  if (patch.peakAbsoluteLp !== undefined) { sets.push("peak_absolute_lp = ?"); values.push(patch.peakAbsoluteLp); }
  if (patch.lastError !== undefined) { sets.push("last_error = ?"); values.push(patch.lastError); }
  values.push(puuid);
  db.prepare(`UPDATE riot_players SET ${sets.join(", ")} WHERE puuid = ?`).run(...values);
}

/** Retire de `riot_players` (et cascade samples/games/live) tout compte que
 *  plus aucun ladder ni déclaration ne référence — équivalent de l'ancien
 *  `removeAccount` qui purgeait l'historique d'un compte retiré. */
export function pruneOrphanPlayers(): void {
  getDb()
    .prepare(
      `DELETE FROM riot_players WHERE puuid NOT IN (
         SELECT puuid FROM ladder_members WHERE puuid IS NOT NULL
         UNION
         SELECT puuid FROM user_riot_accounts WHERE puuid IS NOT NULL
       )`,
    )
    .run();
}

/* ── Relevés de rang ──────────────────────────────────────────────────────── */

export interface LpSample {
  ts: number;
  tier: Tier;
  division: Division | null;
  leaguePoints: number;
  absoluteLp: number;
  wins: number;
  losses: number;
}

interface SampleRow {
  ts: number;
  tier: string;
  division: string | null;
  league_points: number;
  absolute_lp: number;
  wins: number;
  losses: number;
}

function sampleFromRow(row: SampleRow): LpSample {
  return {
    ts: row.ts,
    tier: row.tier as Tier,
    division: row.division as Division | null,
    leaguePoints: row.league_points,
    absoluteLp: row.absolute_lp,
    wins: row.wins,
    losses: row.losses,
  };
}

export function listSamples(puuid: string): LpSample[] {
  const rows = getDb()
    .prepare<[string], SampleRow>("SELECT * FROM rank_samples WHERE puuid = ? ORDER BY ts ASC")
    .all(puuid);
  return rows.map(sampleFromRow);
}

export function addSample(puuid: string, sample: LpSample): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO rank_samples (puuid, ts, tier, division, league_points, absolute_lp, wins, losses)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(puuid, sample.ts, sample.tier, sample.division, sample.leaguePoints, sample.absoluteLp, sample.wins, sample.losses);
}

/** Applique la même politique de rétention que l'ancien `store.prune()`, mais
 *  en relisant/réécrivant les lignes plutôt qu'en tronquant un tableau JSON. */
export function pruneSamples(puuid: string, now = Date.now()): void {
  const db = getDb();
  const current = listSamples(puuid) as RetentionSample[];
  const kept = downsampleSamples(current, now);
  if (kept.length === current.length) return;

  const keptTs = new Set(kept.map((s) => s.ts));
  const run = db.transaction(() => {
    for (const s of current) {
      if (!keptTs.has(s.ts)) {
        db.prepare("DELETE FROM rank_samples WHERE puuid = ? AND ts = ?").run(puuid, s.ts);
      }
    }
  });
  // Verrou d'écriture dès le BEGIN : voir `setMainRiotAccount`. Uniforme sur
  // toutes les transactions d'écriture, pour n'avoir pas à se demander
  // lesquelles lisent d'abord.
  run.immediate();
}

/* ── Parties ──────────────────────────────────────────────────────────────── */

interface GameRow {
  puuid: string;
  id: string;
  champion_id: string;
  champion_name: string;
  role: string;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  lp_delta: number | null;
  duration_sec: number;
  ended_at: number;
  cs: number;
  vision_score: number;
}

function gameFromRow(row: GameRow): GameRecord {
  return {
    id: row.id,
    championId: row.champion_id,
    championName: row.champion_name,
    role: row.role as Role,
    win: row.win === 1,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    lpDelta: row.lp_delta,
    durationSec: row.duration_sec,
    endedAt: row.ended_at,
    cs: row.cs,
    visionScore: row.vision_score,
  };
}

/** Les plus récentes en premier, comme l'ancien `store.games[puuid]`. */
export function listGames(puuid: string, limit?: number): GameRecord[] {
  const db = getDb();
  const rows = limit
    ? (db
        .prepare<[string, number], GameRow>("SELECT * FROM games WHERE puuid = ? ORDER BY ended_at DESC LIMIT ?")
        .all(puuid, limit))
    : (db.prepare<[string], GameRow>("SELECT * FROM games WHERE puuid = ? ORDER BY ended_at DESC").all(puuid));
  return rows.map(gameFromRow);
}

export function upsertGames(puuid: string, games: GameRecord[]): void {
  if (games.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO games
       (puuid, id, champion_id, champion_name, role, win, kills, deaths, assists, lp_delta, duration_sec, ended_at, cs, vision_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const run = db.transaction((rows: GameRecord[]) => {
    for (const g of rows) {
      stmt.run(puuid, g.id, g.championId, g.championName, g.role, g.win ? 1 : 0, g.kills, g.deaths, g.assists, g.lpDelta, g.durationSec, g.endedAt, g.cs, g.visionScore);
    }
  });
  run.immediate(games);
}

export interface EnqueueOptions {
  /**
   * `false` au tout premier relevé d'un compte : `match-v5` renvoie vingt
   * parties d'un coup, et personne ne veut vingt cartes d'un rattrapage
   * d'historique.
   */
  annoncer: boolean;
  /** Au-delà, la partie n'intéresse plus personne (redémarrage, panne). */
  ageMaxMs: number;
  now: number;
}

/**
 * Enregistre les parties **et** met les annonçables en file, d'un seul bloc.
 *
 * L'atomicité est le point : un plantage entre les deux perdrait la partie
 * pour toujours. Au cycle suivant elle serait déjà connue, donc absente des
 * « nouvelles parties », et plus rien ne la signalerait au bot.
 */
export function upsertGamesAndEnqueue(
  puuid: string,
  games: GameRecord[],
  options: EnqueueOptions,
): number {
  if (games.length === 0) return 0;
  const db = getDb();

  const inserer = db.prepare(
    `INSERT OR IGNORE INTO games
       (puuid, id, champion_id, champion_name, role, win, kills, deaths, assists, lp_delta, duration_sec, ended_at, cs, vision_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const enfiler = db.prepare(
    `INSERT INTO game_events (puuid, match_id, ended_at, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(puuid, match_id) DO NOTHING`,
  );

  let enfilees = 0;
  const run = db.transaction((rows: GameRecord[]) => {
    for (const g of rows) {
      inserer.run(puuid, g.id, g.championId, g.championName, g.role, g.win ? 1 : 0, g.kills, g.deaths, g.assists, g.lpDelta, g.durationSec, g.endedAt, g.cs, g.visionScore);

      if (!options.annoncer) continue;
      if (options.now - g.endedAt > options.ageMaxMs) continue;
      enfilees += enfiler.run(puuid, g.id, g.endedAt, options.now).changes;
    }
  });
  run.immediate(games);

  return enfilees;
}

/** Met à jour un delta de LP déjà connu (remplissage par encadrement de relevés). */
export function setGameLpDelta(puuid: string, gameId: string, lpDelta: number): void {
  getDb().prepare("UPDATE games SET lp_delta = ? WHERE puuid = ? AND id = ?").run(lpDelta, puuid, gameId);
}

export function pruneGames(puuid: string): void {
  const db = getDb();
  const excess = db
    .prepare<[string, number], { id: string }>(
      "SELECT id FROM games WHERE puuid = ? ORDER BY ended_at DESC LIMIT -1 OFFSET ?",
    )
    .all(puuid, MAX_GAMES);
  if (excess.length === 0) return;
  const del = db.prepare("DELETE FROM games WHERE puuid = ? AND id = ?");
  const run = db.transaction(() => {
    for (const g of excess) del.run(puuid, g.id);
  });
  run.immediate();
}

/* ── Partie en cours ──────────────────────────────────────────────────────── */

interface LiveRow {
  champion_id: string | null;
  champion_name: string | null;
  role: string | null;
  started_at: number;
}

export function getLive(puuid: string): LiveGame | null {
  const row = getDb().prepare<[string], LiveRow>("SELECT * FROM live_games WHERE puuid = ?").get(puuid);
  if (!row) return null;
  return {
    championId: row.champion_id ?? "",
    championName: row.champion_name ?? "champion inconnu",
    role: (row.role as Role) ?? "MIDDLE",
    startedAt: row.started_at,
  };
}

export function setLive(puuid: string, live: LiveGame | null): void {
  const db = getDb();
  if (!live) {
    db.prepare("DELETE FROM live_games WHERE puuid = ?").run(puuid);
    return;
  }
  db.prepare(
    `INSERT INTO live_games (puuid, champion_id, champion_name, role, started_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(puuid) DO UPDATE SET champion_id = excluded.champion_id,
       champion_name = excluded.champion_name, role = excluded.role, started_at = excluded.started_at`,
  ).run(puuid, live.championId, live.championName, live.role, live.startedAt);
}


/* ── Méta de synchronisation ──────────────────────────────────────────────── */

export function getSyncMeta(): { lastSync: number | null; lastSyncError: string | null } {
  const row = getDb()
    .prepare<[], { last_sync: number | null; last_sync_error: string | null }>(
      "SELECT last_sync, last_sync_error FROM sync_meta WHERE id = 1",
    )
    .get();
  return { lastSync: row?.last_sync ?? null, lastSyncError: row?.last_sync_error ?? null };
}

export function setSyncMeta(lastSync: number, lastSyncError: string | null): void {
  getDb()
    .prepare("UPDATE sync_meta SET last_sync = ?, last_sync_error = ? WHERE id = 1")
    .run(lastSync, lastSyncError);
}
