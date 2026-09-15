import { randomUUID } from "node:crypto";
import { getDb } from "./client";

export interface UserRecord {
  id: string;
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  createdAt: number;
  lastLoginAt: number;
}

interface UserRow {
  id: string;
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  created_at: number;
  last_login_at: number;
}

function fromRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    discordId: row.discord_id,
    username: row.username,
    globalName: row.global_name,
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * Upsert appelé depuis le callback `jwt()` d'Auth.js à chaque connexion —
 * c'est la seule écriture que ce module fait dans `users`, volontairement :
 * pas d'Adapter Auth.js, pas de schéma générique, un mapping qu'on maîtrise.
 */
export function findOrCreateUserByDiscord(profile: {
  id: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
}): UserRecord {
  const db = getDb();
  const now = Date.now();

  const existing = db
    .prepare<[string], UserRow>("SELECT * FROM users WHERE discord_id = ?")
    .get(profile.id);

  if (existing) {
    db.prepare(
      "UPDATE users SET username = ?, global_name = ?, avatar = ?, last_login_at = ? WHERE id = ?",
    ).run(profile.username, profile.globalName ?? null, profile.avatar ?? null, now, existing.id);
    return fromRow({ ...existing, username: profile.username, global_name: profile.globalName ?? null, avatar: profile.avatar ?? null, last_login_at: now });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, discord_id, username, global_name, avatar, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, profile.id, profile.username, profile.globalName ?? null, profile.avatar ?? null, now, now);

  return {
    id,
    discordId: profile.id,
    username: profile.username,
    globalName: profile.globalName ?? null,
    avatar: profile.avatar ?? null,
    createdAt: now,
    lastLoginAt: now,
  };
}

export function getUser(id: string): UserRecord | null {
  const row = getDb()
    .prepare<[string], UserRow>("SELECT * FROM users WHERE id = ?")
    .get(id);
  return row ? fromRow(row) : null;
}

export function getUserByDiscordId(discordId: string): UserRecord | null {
  const row = getDb()
    .prepare<[string], UserRow>("SELECT * FROM users WHERE discord_id = ?")
    .get(discordId);
  return row ? fromRow(row) : null;
}

/* ── « Mes comptes » — déclaration libre, sert à la découverte croisée ────── */

export interface ClaimedAccount {
  id: number;
  region: string;
  gameName: string;
  tagLine: string;
  puuid: string | null;
  resolveError: string | null;
  addedAt: number;
  /** Renseignés une fois le compte résolu par la synchronisation. */
  profileIconId: number | null;
  summonerLevel: number | null;
}

export class DuplicateClaimError extends Error {
  constructor(label: string) {
    super(`${label} est déjà dans tes comptes.`);
    this.name = "DuplicateClaimError";
  }
}

export function claimRiotAccount(
  userId: string,
  input: { gameName: string; tagLine: string; region: string },
): void {
  const db = getDb();
  const dup = db
    .prepare(
      `SELECT id FROM user_riot_accounts
       WHERE user_id = ? AND region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE`,
    )
    .get(userId, input.region, input.gameName, input.tagLine);
  if (dup) throw new DuplicateClaimError(`${input.gameName}#${input.tagLine}`);

  db.prepare(
    `INSERT INTO user_riot_accounts (user_id, region, game_name, tag_line, added_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(userId, input.region, input.gameName, input.tagLine, Date.now());
}

export function unclaimRiotAccount(userId: string, id: number): void {
  getDb()
    .prepare("DELETE FROM user_riot_accounts WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

export function listClaimedAccounts(userId: string): ClaimedAccount[] {
  const rows = getDb()
    .prepare(
      `SELECT ura.id, ura.region, ura.game_name, ura.tag_line, ura.puuid,
              ura.resolve_error, ura.added_at,
              rp.profile_icon_id, rp.summoner_level
       FROM user_riot_accounts ura
       LEFT JOIN riot_players rp ON rp.puuid = ura.puuid
       WHERE ura.user_id = ?
       ORDER BY ura.added_at ASC`,
    )
    .all(userId) as Array<{
    id: number;
    region: string;
    game_name: string;
    tag_line: string;
    puuid: string | null;
    resolve_error: string | null;
    added_at: number;
    profile_icon_id: number | null;
    summoner_level: number | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    region: r.region,
    gameName: r.game_name,
    tagLine: r.tag_line,
    puuid: r.puuid,
    resolveError: r.resolve_error,
    addedAt: r.added_at,
    profileIconId: r.profile_icon_id,
    summonerLevel: r.summoner_level,
  }));
}

/* ── Découverte croisée ───────────────────────────────────────────────────── */

export interface LadderRef {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  memberCount: number;
}

interface LadderRefRow {
  id: string;
  slug: string;
  name: string;
  owner_user_id: string;
  member_count: number;
}

/**
 * Ladders possédés par l'utilisateur, et ladders où apparaît un des comptes
 * Riot qu'il a déclarés comme siens (même s'il ne les a pas créés).
 */
export function laddersForUser(userId: string): {
  owned: LadderRef[];
  appearingIn: LadderRef[];
} {
  const db = getDb();

  const owned = db
    .prepare<[string], LadderRefRow>(
      `SELECT l.id, l.slug, l.name, l.owner_user_id,
              (SELECT COUNT(*) FROM ladder_members lm WHERE lm.ladder_id = l.id) AS member_count
       FROM ladders l WHERE l.owner_user_id = ? ORDER BY l.created_at DESC`,
    )
    .all(userId);

  const appearingIn = db
    .prepare<[string, string], LadderRefRow>(
      `SELECT DISTINCT l.id, l.slug, l.name, l.owner_user_id,
              (SELECT COUNT(*) FROM ladder_members lm2 WHERE lm2.ladder_id = l.id) AS member_count
       FROM user_riot_accounts ura
       JOIN ladder_members lm ON lm.puuid = ura.puuid
       JOIN ladders l ON l.id = lm.ladder_id
       WHERE ura.user_id = ? AND ura.puuid IS NOT NULL AND l.owner_user_id != ?
       ORDER BY l.created_at DESC`,
    )
    .all(userId, userId);

  const toRef = (r: LadderRefRow): LadderRef => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    ownerUserId: r.owner_user_id,
    memberCount: r.member_count,
  });

  return { owned: owned.map(toRef), appearingIn: appearingIn.map(toRef) };
}
