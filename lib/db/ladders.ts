import { randomUUID } from "node:crypto";
import type { Region, Role } from "@/lib/types";
import { getDb } from "./client";

export interface LadderRecord {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  createdAt: number;
}

export interface LadderMemberRecord {
  id: number;
  ladderId: string;
  region: Region;
  gameName: string;
  tagLine: string;
  puuid: string | null;
  country?: string;
  roleOverride?: Role;
  addedByUserId: string | null;
  addedAt: number;
  resolveError?: string;
}

interface LadderRow {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  created_at: number;
}

interface MemberRow {
  id: number;
  ladder_id: string;
  region: string;
  game_name: string;
  tag_line: string;
  puuid: string | null;
  country: string | null;
  role_override: string | null;
  added_by_user_id: string | null;
  added_at: number;
  resolve_error: string | null;
}

function ladderFromRow(row: LadderRow): LadderRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  };
}

function memberFromRow(row: MemberRow): LadderMemberRecord {
  return {
    id: row.id,
    ladderId: row.ladder_id,
    region: row.region as Region,
    gameName: row.game_name,
    tagLine: row.tag_line,
    puuid: row.puuid,
    country: row.country ?? undefined,
    roleOverride: (row.role_override as Role | null) ?? undefined,
    addedByUserId: row.added_by_user_id,
    addedAt: row.added_at,
    resolveError: row.resolve_error ?? undefined,
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "ladder";
}

/* ── Ladders ──────────────────────────────────────────────────────────────── */

export function createLadder(input: { name: string; ownerUserId: string }): LadderRecord {
  const db = getDb();
  const base = slugify(input.name);
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM ladders WHERE slug = ?").get(slug)) {
    slug = `${base}-${n++}`;
  }

  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO ladders (id, owner_user_id, name, slug, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, input.ownerUserId, input.name, slug, createdAt);

  return { id, ownerUserId: input.ownerUserId, name: input.name, slug, createdAt };
}

export function getLadderBySlug(slug: string): LadderRecord | null {
  const row = getDb()
    .prepare<[string], LadderRow>("SELECT * FROM ladders WHERE slug = ?")
    .get(slug);
  return row ? ladderFromRow(row) : null;
}

export function getLadderById(id: string): LadderRecord | null {
  const row = getDb()
    .prepare<[string], LadderRow>("SELECT * FROM ladders WHERE id = ?")
    .get(id);
  return row ? ladderFromRow(row) : null;
}

/** Renomme le ladder ; régénère le slug si `keepSlug` n'est pas passé. */
export function renameLadder(id: string, name: string, keepSlug = false): LadderRecord | null {
  const db = getDb();
  const existing = getLadderById(id);
  if (!existing) return null;

  if (keepSlug) {
    db.prepare("UPDATE ladders SET name = ? WHERE id = ?").run(name, id);
    return { ...existing, name };
  }

  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (true) {
    const row = db.prepare<[string], { id: string }>("SELECT id FROM ladders WHERE slug = ?").get(slug);
    if (!row || row.id === id) break;
    slug = `${base}-${n++}`;
  }
  db.prepare("UPDATE ladders SET name = ?, slug = ? WHERE id = ?").run(name, slug, id);
  return { ...existing, name, slug };
}

export function deleteLadder(id: string): void {
  getDb().prepare("DELETE FROM ladders WHERE id = ?").run(id);
}

/* ── Membres ──────────────────────────────────────────────────────────────── */

export class DuplicateMemberError extends Error {
  constructor(label: string) {
    super(`${label} est déjà dans ce ladder.`);
    this.name = "DuplicateMemberError";
  }
}

export interface AddMemberInput {
  gameName: string;
  tagLine: string;
  region: Region;
  country?: string;
  roleOverride?: Role;
}

export function addMember(
  ladderId: string,
  input: AddMemberInput,
  addedByUserId: string | null,
): LadderMemberRecord {
  const db = getDb();

  const dup = db
    .prepare(
      `SELECT id FROM ladder_members
       WHERE ladder_id = ? AND region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE`,
    )
    .get(ladderId, input.region, input.gameName, input.tagLine);
  if (dup) throw new DuplicateMemberError(`${input.gameName}#${input.tagLine}`);

  // Si ce compte est déjà résolu ailleurs (autre ladder), on repart de son
  // puuid connu : ça évite un aller-retour Riot pour rien, et rattache
  // immédiatement les deux appartenances au même historique.
  const known = db
    .prepare<[string, string, string], { puuid: string }>(
      `SELECT puuid FROM ladder_members
       WHERE puuid IS NOT NULL AND region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE
       LIMIT 1`,
    )
    .get(input.region, input.gameName, input.tagLine);

  const addedAt = Date.now();
  const result = db
    .prepare(
      `INSERT INTO ladder_members
         (ladder_id, region, game_name, tag_line, puuid, country, role_override, added_by_user_id, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      ladderId,
      input.region,
      input.gameName,
      input.tagLine,
      known?.puuid ?? null,
      input.country ?? null,
      input.roleOverride ?? null,
      addedByUserId,
      addedAt,
    );

  return {
    id: Number(result.lastInsertRowid),
    ladderId,
    region: input.region,
    gameName: input.gameName,
    tagLine: input.tagLine,
    puuid: known?.puuid ?? null,
    country: input.country,
    roleOverride: input.roleOverride,
    addedByUserId,
    addedAt,
  };
}

/** Oublie le puuid résolu pour un membre — n'affecte que cette ligne, jamais
 *  `riot_players` ni les autres appartenances du même compte. */
export function forgetMemberPuuid(ladderId: string, memberId: number): void {
  getDb()
    .prepare("UPDATE ladder_members SET puuid = NULL, resolve_error = NULL WHERE id = ? AND ladder_id = ?")
    .run(memberId, ladderId);
}

export function removeMember(ladderId: string, memberId: number): void {
  getDb()
    .prepare("DELETE FROM ladder_members WHERE id = ? AND ladder_id = ?")
    .run(memberId, ladderId);
}

export function patchMember(
  ladderId: string,
  memberId: number,
  patch: Partial<Pick<LadderMemberRecord, "country" | "roleOverride">>,
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (patch.country !== undefined) { sets.push("country = ?"); values.push(patch.country); }
  if (patch.roleOverride !== undefined) { sets.push("role_override = ?"); values.push(patch.roleOverride); }
  if (sets.length === 0) return;

  values.push(memberId, ladderId);
  db.prepare(`UPDATE ladder_members SET ${sets.join(", ")} WHERE id = ? AND ladder_id = ?`).run(...values);
}

export function listMembers(ladderId: string): LadderMemberRecord[] {
  const rows = getDb()
    .prepare<[string], MemberRow>("SELECT * FROM ladder_members WHERE ladder_id = ? ORDER BY added_at ASC")
    .all(ladderId);
  return rows.map(memberFromRow);
}

/**
 * Les ladders qui suivent ce compte.
 *
 * Utilisé par les comptes rendus d'après-game : une partie doit être annoncée
 * dans chaque salon lié à un ladder où le joueur figure — un compte suivi par
 * deux ladders produit donc deux annonces, dans deux salons différents, ce
 * qui est le comportement voulu.
 */
export function laddersContainingPuuid(puuid: string): LadderRecord[] {
  return getDb()
    .prepare<[string], LadderRow>(
      `SELECT DISTINCT l.* FROM ladders l
         JOIN ladder_members m ON m.ladder_id = l.id
        WHERE m.puuid = ?`,
    )
    .all(puuid)
    .map(ladderFromRow);
}
