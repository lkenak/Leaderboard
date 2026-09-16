import { getDb } from "./client";
import type { LadderRecord } from "./ladders";

/**
 * Liaisons entre les ladders du site et les serveurs Discord.
 *
 * Partagé par le bot et par les Server Actions du site : c'est la seule
 * définition de « ce serveur suit ce ladder », et elle ne doit pas exister en
 * deux exemplaires.
 */

export interface GuildLinkRecord {
  id: number;
  ladderId: string;
  guildId: string;
  reportChannelId: string | null;
  reportError: string | null;
  isDefault: boolean;
  addedByUserId: string | null;
  createdAt: number;
}

/** Une liaison, accompagnée du ladder qu'elle désigne — le besoin courant. */
export interface GuildLinkWithLadder extends GuildLinkRecord {
  ladder: LadderRecord;
}

interface LinkRow {
  id: number;
  ladder_id: string;
  guild_id: string;
  report_channel_id: string | null;
  report_error: string | null;
  is_default: number;
  added_by_user_id: string | null;
  created_at: number;
}

interface JoinedRow extends LinkRow {
  l_id: string;
  l_owner_user_id: string;
  l_name: string;
  l_slug: string;
  l_created_at: number;
}

function fromRow(row: LinkRow): GuildLinkRecord {
  return {
    id: row.id,
    ladderId: row.ladder_id,
    guildId: row.guild_id,
    reportChannelId: row.report_channel_id,
    reportError: row.report_error,
    isDefault: row.is_default === 1,
    addedByUserId: row.added_by_user_id,
    createdAt: row.created_at,
  };
}

function joinedFromRow(row: JoinedRow): GuildLinkWithLadder {
  return {
    ...fromRow(row),
    ladder: {
      id: row.l_id,
      ownerUserId: row.l_owner_user_id,
      name: row.l_name,
      slug: row.l_slug,
      createdAt: row.l_created_at,
    },
  };
}

const SELECT_JOINED = `
  SELECT g.*,
         l.id AS l_id, l.owner_user_id AS l_owner_user_id, l.name AS l_name,
         l.slug AS l_slug, l.created_at AS l_created_at
    FROM ladder_discord_guilds g
    JOIN ladders l ON l.id = g.ladder_id`;

/* ── Lecture ──────────────────────────────────────────────────────────────── */

/** Les ladders suivis par un serveur, le ladder par défaut en tête. */
export function listLinksForGuild(guildId: string): GuildLinkWithLadder[] {
  return getDb()
    .prepare<[string], JoinedRow>(
      `${SELECT_JOINED} WHERE g.guild_id = ? ORDER BY g.is_default DESC, l.name COLLATE NOCASE`,
    )
    .all(guildId)
    .map(joinedFromRow);
}

/**
 * Le ladder qu'affiche `/classement` sans argument.
 *
 * Le `is_default` s'il existe, sinon la seule liaison quand il n'y en a
 * qu'une : exiger `/ladder defaut` alors qu'il n'y a pas d'ambiguïté serait
 * une étape administrative pour rien.
 */
export function defaultLinkForGuild(guildId: string): GuildLinkWithLadder | null {
  const liens = listLinksForGuild(guildId);
  if (liens.length === 0) return null;
  return liens.find((l) => l.isDefault) ?? (liens.length === 1 ? liens[0] : null);
}

export function findLink(guildId: string, ladderId: string): GuildLinkWithLadder | null {
  const row = getDb()
    .prepare<[string, string], JoinedRow>(
      `${SELECT_JOINED} WHERE g.guild_id = ? AND g.ladder_id = ?`,
    )
    .get(guildId, ladderId);
  return row ? joinedFromRow(row) : null;
}

/** Les serveurs qui suivent un ladder — pour les rapports de fin de partie. */
export function listLinksForLadder(ladderId: string): GuildLinkRecord[] {
  return getDb()
    .prepare<[string], LinkRow>(
      "SELECT * FROM ladder_discord_guilds WHERE ladder_id = ? ORDER BY created_at",
    )
    .all(ladderId)
    .map(fromRow);
}

/* ── Écriture ─────────────────────────────────────────────────────────────── */

export interface LinkInput {
  ladderId: string;
  guildId: string;
  reportChannelId: string | null;
  addedByUserId: string | null;
}

/**
 * Lie un ladder à un serveur, ou met à jour la liaison existante.
 *
 * La première liaison d'un serveur devient son défaut : sans ça, un serveur
 * qui n'en a qu'une devrait quand même passer `/ladder defaut` avant que
 * `/classement` ne réponde.
 */
export function linkLadderToGuild(input: LinkInput): GuildLinkWithLadder {
  const db = getDb();

  const run = db.transaction(() => {
    const existant = db
      .prepare<[string, string], LinkRow>(
        "SELECT * FROM ladder_discord_guilds WHERE guild_id = ? AND ladder_id = ?",
      )
      .get(input.guildId, input.ladderId);

    if (existant) {
      db.prepare(
        `UPDATE ladder_discord_guilds
            SET report_channel_id = ?, report_error = NULL
          WHERE id = ?`,
      ).run(input.reportChannelId, existant.id);
      return;
    }

    const premier =
      db
        .prepare<[string], { n: number }>(
          "SELECT COUNT(*) AS n FROM ladder_discord_guilds WHERE guild_id = ?",
        )
        .get(input.guildId)?.n === 0;

    db.prepare(
      `INSERT INTO ladder_discord_guilds
         (ladder_id, guild_id, report_channel_id, is_default, added_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      input.ladderId,
      input.guildId,
      input.reportChannelId,
      premier ? 1 : 0,
      input.addedByUserId,
      Date.now(),
    );
  });

  // Verrou d'écriture dès le BEGIN : cette transaction lit avant d'écrire, et
  // une promotion de verrou refusée n'honore pas `busy_timeout` (voir
  // `lib/db/client.ts`). Deux processus écrivent désormais dans ce fichier.
  run.immediate();

  const lien = findLink(input.guildId, input.ladderId);
  if (!lien) throw new Error("Liaison introuvable juste après son écriture.");
  return lien;
}

export function unlinkLadderFromGuild(guildId: string, ladderId: string): boolean {
  const db = getDb();
  let supprime = false;

  const run = db.transaction(() => {
    const lien = db
      .prepare<[string, string], LinkRow>(
        "SELECT * FROM ladder_discord_guilds WHERE guild_id = ? AND ladder_id = ?",
      )
      .get(guildId, ladderId);
    if (!lien) return;

    db.prepare("DELETE FROM ladder_discord_guilds WHERE id = ?").run(lien.id);
    supprime = true;

    // Délier le défaut ne doit pas laisser le serveur sans : la plus ancienne
    // des liaisons restantes prend la place, comme `unclaimRiotAccount` le
    // fait pour le compte principal.
    if (lien.is_default === 1) {
      db.prepare(
        `UPDATE ladder_discord_guilds SET is_default = 1
          WHERE id = (SELECT id FROM ladder_discord_guilds
                       WHERE guild_id = ? ORDER BY created_at ASC LIMIT 1)`,
      ).run(guildId);
    }
  });
  run.immediate();

  return supprime;
}

/** Désigne le ladder par défaut du serveur, et retire le statut aux autres. */
export function setDefaultLink(guildId: string, ladderId: string): boolean {
  const db = getDb();
  let fait = false;

  const run = db.transaction(() => {
    const lien = db
      .prepare<[string, string], LinkRow>(
        "SELECT id FROM ladder_discord_guilds WHERE guild_id = ? AND ladder_id = ?",
      )
      .get(guildId, ladderId);
    if (!lien) return;

    db.prepare("UPDATE ladder_discord_guilds SET is_default = 0 WHERE guild_id = ?").run(guildId);
    db.prepare("UPDATE ladder_discord_guilds SET is_default = 1 WHERE id = ?").run(lien.id);
    fait = true;
  });
  run.immediate();

  return fait;
}

/** Change (ou coupe, avec `null`) le salon des rapports. */
export function setReportChannel(
  guildId: string,
  ladderId: string,
  channelId: string | null,
): boolean {
  const res = getDb()
    .prepare(
      `UPDATE ladder_discord_guilds
          SET report_channel_id = ?, report_error = NULL
        WHERE guild_id = ? AND ladder_id = ?`,
    )
    .run(channelId, guildId, ladderId);
  return res.changes > 0;
}

/**
 * Coupe les rapports après un refus de Discord, en gardant la raison.
 *
 * Appelé par le lot 4 sur 50013 / 50001 / 10003 : on arrête plutôt que de
 * réessayer, et `/ladder etat` rend la panne visible.
 */
export function disableReportChannel(
  guildId: string,
  ladderId: string,
  raison: string,
): void {
  getDb()
    .prepare(
      `UPDATE ladder_discord_guilds
          SET report_channel_id = NULL, report_error = ?
        WHERE guild_id = ? AND ladder_id = ?`,
    )
    .run(raison, guildId, ladderId);
}
