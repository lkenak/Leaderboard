import { getDb } from "./client";
import type { Division, Role, Tier } from "@/lib/types";

/**
 * Parties personnalisées : sessions, participants, profils de repli.
 *
 * La règle qui gouverne tout ce module : **la base est la vérité, le message
 * Discord n'en est qu'une projection**. Chaque interaction écrit ici d'abord,
 * puis on redessine le message à partir de ce qui est écrit. C'est ce qui
 * rendait l'ancien bot robuste aux redémarrages et aux clics concurrents, et
 * c'est ce qui permettra de remplacer l'embed par une image sans toucher au
 * reste.
 */

export type PpStatus = "OPEN" | "FULL" | "CANCELLED";
export type PpFormat = "BO1" | "BO3" | "BO5";
export type PpMode = "NORMAL" | "FEARLESS" | "ARAM_MAYHEM";
export type PpParticipantStatus = "PARTICIPANT" | "WAITLIST" | "UNAVAILABLE";

export interface PpSession {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  organizerDiscordId: string;
  heureLabel: string;
  dateLabel: string;
  startsAt: number | null;
  format: PpFormat;
  mode: PpMode;
  maxPlayers: number;
  status: PpStatus;
  reminderSent: boolean;
  createdAt: number;
}

export interface PpParticipant {
  discordUserId: string;
  status: PpParticipantStatus;
  updatedAt: number;
}

export interface PpProfile {
  discordUserId: string;
  tier: Tier;
  division: Division | "NA";
  mainRole: Role;
  secondaryRole: Role;
}

interface SessionRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  organizer_discord_id: string;
  heure_label: string;
  date_label: string;
  starts_at: number | null;
  format: PpFormat;
  mode: PpMode;
  max_players: number;
  status: PpStatus;
  reminder_sent: number;
  created_at: number;
}

interface ParticipantRow {
  discord_user_id: string;
  status: PpParticipantStatus;
  updated_at: number;
}

interface ProfileRow {
  discord_user_id: string;
  tier: string;
  division: string;
  main_role: string;
  secondary_role: string;
}

function sessionFromRow(r: SessionRow): PpSession {
  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    messageId: r.message_id,
    organizerDiscordId: r.organizer_discord_id,
    heureLabel: r.heure_label,
    dateLabel: r.date_label,
    startsAt: r.starts_at,
    format: r.format,
    mode: r.mode,
    maxPlayers: r.max_players,
    status: r.status,
    reminderSent: r.reminder_sent === 1,
    createdAt: r.created_at,
  };
}

/* ── Sessions ─────────────────────────────────────────────────────────────── */

export interface CreateSessionInput {
  guildId: string;
  channelId: string;
  organizerDiscordId: string;
  heureLabel: string;
  dateLabel: string;
  startsAt: number | null;
  format: PpFormat;
  mode: PpMode;
  maxPlayers: number;
}

export function createSession(input: CreateSessionInput): PpSession {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO pp_sessions
         (guild_id, channel_id, organizer_discord_id, heure_label, date_label,
          starts_at, format, mode, max_players, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.guildId,
      input.channelId,
      input.organizerDiscordId,
      input.heureLabel,
      input.dateLabel,
      input.startsAt,
      input.format,
      input.mode,
      input.maxPlayers,
      Date.now(),
    );
  return getSession(Number(info.lastInsertRowid))!;
}

export function getSession(id: number): PpSession | null {
  const row = getDb()
    .prepare<[number], SessionRow>("SELECT * FROM pp_sessions WHERE id = ?")
    .get(id);
  return row ? sessionFromRow(row) : null;
}

export function setSessionMessage(id: number, channelId: string, messageId: string): void {
  getDb()
    .prepare("UPDATE pp_sessions SET channel_id = ?, message_id = ? WHERE id = ?")
    .run(channelId, messageId, id);
}

export function cancelSession(id: number): void {
  getDb().prepare("UPDATE pp_sessions SET status = 'CANCELLED' WHERE id = ?").run(id);
}

/**
 * Recalcule `OPEN` / `FULL` depuis le nombre d'inscrits.
 *
 * Appelé après chaque écriture de participant. Le statut est donc une
 * conséquence des données, jamais une chose qu'on met à jour à la main et
 * qu'on oublie quelque part — `CANCELLED` mis à part, qui est une décision.
 */
export function refreshSessionStatus(id: number): PpStatus {
  const db = getDb();
  const session = getSession(id);
  if (!session || session.status === "CANCELLED") return session?.status ?? "CANCELLED";

  const n = countParticipants(id);
  const statut: PpStatus = n >= session.maxPlayers ? "FULL" : "OPEN";
  if (statut !== session.status) {
    db.prepare("UPDATE pp_sessions SET status = ? WHERE id = ?").run(statut, id);
  }
  return statut;
}

/** Les sessions dont le rappel doit partir maintenant. */
export function sessionsToRemind(now: number, avanceMs: number): PpSession[] {
  return getDb()
    .prepare<[number, number], SessionRow>(
      `SELECT * FROM pp_sessions
        WHERE reminder_sent = 0
          AND status <> 'CANCELLED'
          AND starts_at IS NOT NULL
          AND starts_at <= ?
          AND starts_at > ?`,
    )
    .all(now + avanceMs, now)
    .map(sessionFromRow);
}

export function markReminderSent(id: number): void {
  getDb().prepare("UPDATE pp_sessions SET reminder_sent = 1 WHERE id = ?").run(id);
}

/* ── Participants ─────────────────────────────────────────────────────────── */

export function listParticipants(sessionId: number): PpParticipant[] {
  return getDb()
    .prepare<[number], ParticipantRow>(
      `SELECT discord_user_id, status, updated_at FROM pp_participants
        WHERE session_id = ? ORDER BY updated_at ASC`,
    )
    .all(sessionId)
    .map((r) => ({
      discordUserId: r.discord_user_id,
      status: r.status,
      updatedAt: r.updated_at,
    }));
}

export function countParticipants(sessionId: number): number {
  return (
    getDb()
      .prepare<[number], { n: number }>(
        "SELECT COUNT(*) AS n FROM pp_participants WHERE session_id = ? AND status = 'PARTICIPANT'",
      )
      .get(sessionId)?.n ?? 0
  );
}

export function getParticipant(
  sessionId: number,
  discordUserId: string,
): PpParticipant | null {
  const r = getDb()
    .prepare<[number, string], ParticipantRow>(
      `SELECT discord_user_id, status, updated_at FROM pp_participants
        WHERE session_id = ? AND discord_user_id = ?`,
    )
    .get(sessionId, discordUserId);
  return r
    ? { discordUserId: r.discord_user_id, status: r.status, updatedAt: r.updated_at }
    : null;
}

/**
 * Inscrit quelqu'un, en file d'attente si la PP est pleine.
 *
 * Le comptage et l'insertion sont dans la même transaction : deux personnes
 * qui cliquent en même temps sur la dernière place ne doivent pas être
 * inscrites toutes les deux.
 */
export function join(
  sessionId: number,
  discordUserId: string,
  maxPlayers: number,
): PpParticipantStatus {
  const db = getDb();
  let statut: PpParticipantStatus = "PARTICIPANT";

  const run = db.transaction(() => {
    const n =
      db
        .prepare<[number, string], { n: number }>(
          `SELECT COUNT(*) AS n FROM pp_participants
            WHERE session_id = ? AND status = 'PARTICIPANT' AND discord_user_id <> ?`,
        )
        .get(sessionId, discordUserId)?.n ?? 0;

    statut = n >= maxPlayers ? "WAITLIST" : "PARTICIPANT";
    db.prepare(
      `INSERT INTO pp_participants (session_id, discord_user_id, status, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, discord_user_id)
         DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
    ).run(sessionId, discordUserId, statut, Date.now());
  });
  run.immediate();

  return statut;
}

export function setUnavailable(sessionId: number, discordUserId: string): void {
  getDb()
    .prepare(
      `INSERT INTO pp_participants (session_id, discord_user_id, status, updated_at)
       VALUES (?, ?, 'UNAVAILABLE', ?)
       ON CONFLICT(session_id, discord_user_id)
         DO UPDATE SET status = 'UNAVAILABLE', updated_at = excluded.updated_at`,
    )
    .run(sessionId, discordUserId, Date.now());
}

export function leave(sessionId: number, discordUserId: string): void {
  getDb()
    .prepare("DELETE FROM pp_participants WHERE session_id = ? AND discord_user_id = ?")
    .run(sessionId, discordUserId);
}

/**
 * Remplit les places libres avec la file d'attente, les plus anciens d'abord.
 * Renvoie les identifiants promus, pour pouvoir les prévenir.
 */
export function promoteWaitlist(sessionId: number, maxPlayers: number): string[] {
  const db = getDb();
  const promus: string[] = [];

  const run = db.transaction(() => {
    let n =
      db
        .prepare<[number], { n: number }>(
          "SELECT COUNT(*) AS n FROM pp_participants WHERE session_id = ? AND status = 'PARTICIPANT'",
        )
        .get(sessionId)?.n ?? 0;
    if (n >= maxPlayers) return;

    const attente = db
      .prepare<[number], { discord_user_id: string }>(
        `SELECT discord_user_id FROM pp_participants
          WHERE session_id = ? AND status = 'WAITLIST' ORDER BY updated_at ASC`,
      )
      .all(sessionId);

    for (const w of attente) {
      if (n >= maxPlayers) break;
      db.prepare(
        `UPDATE pp_participants SET status = 'PARTICIPANT', updated_at = ?
          WHERE session_id = ? AND discord_user_id = ?`,
      ).run(Date.now(), sessionId, w.discord_user_id);
      promus.push(w.discord_user_id);
      n++;
    }
  });
  run.immediate();

  return promus;
}

/* ── Profils de repli ─────────────────────────────────────────────────────── */

export function getProfile(discordUserId: string): PpProfile | null {
  const r = getDb()
    .prepare<[string], ProfileRow>("SELECT * FROM pp_profiles WHERE discord_user_id = ?")
    .get(discordUserId);
  if (!r) return null;
  return {
    discordUserId: r.discord_user_id,
    tier: r.tier as Tier,
    division: r.division as Division | "NA",
    mainRole: r.main_role as Role,
    secondaryRole: r.secondary_role as Role,
  };
}

export function upsertProfile(profile: PpProfile): void {
  getDb()
    .prepare(
      `INSERT INTO pp_profiles
         (discord_user_id, tier, division, main_role, secondary_role, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(discord_user_id) DO UPDATE SET
         tier = excluded.tier, division = excluded.division,
         main_role = excluded.main_role, secondary_role = excluded.secondary_role,
         updated_at = excluded.updated_at`,
    )
    .run(
      profile.discordUserId,
      profile.tier,
      profile.division,
      profile.mainRole,
      profile.secondaryRole,
      Date.now(),
    );
}
