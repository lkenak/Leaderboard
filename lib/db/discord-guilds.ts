import { getDb } from "./client";
import type { LadderRecord } from "./ladders";

/**
 * Liaisons entre les ladders du site et les serveurs Discord.
 *
 * Partagé par le bot et par les Server Actions du site : c'est la seule
 * définition de « ce serveur suit ce ladder », et elle ne doit pas exister en
 * deux exemplaires.
 */

/**
 * Débit des comptes rendus, par liaison.
 *
 *  - `chaque-partie` : une carte par partie classée, dès qu'elle est connue ;
 *  - `resume-soiree` : une seule carte quand la série de parties s'arrête.
 *
 * Le silence complet n'est pas un mode : c'est `reportChannelId === null`,
 * qui existait déjà et dit exactement ça.
 */
export type ReportMode = "chaque-partie" | "resume-soiree";

export const REPORT_MODES: readonly ReportMode[] = ["chaque-partie", "resume-soiree"];

export interface GuildLinkRecord {
  id: number;
  ladderId: string;
  guildId: string;
  reportChannelId: string | null;
  reportError: string | null;
  reportMode: ReportMode;
  /** Fin de la derniere partie deja couverte par un resume. */
  lastDigestAt: number | null;
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
  report_mode: string;
  last_digest_at: number | null;
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
    // Le CHECK de la migration garantit la valeur ; le repli couvre une base
    // migrée à la main plutôt que de propager un mode inconnu jusqu'au bot.
    reportMode: (REPORT_MODES as readonly string[]).includes(row.report_mode)
      ? (row.report_mode as ReportMode)
      : "chaque-partie",
    lastDigestAt: row.last_digest_at,
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
 * Change le débit des comptes rendus d'une liaison.
 *
 * Le passage en résumé pose la borne à maintenant, dans la même écriture. Sans
 * ça, le premier résumé embarquerait tout ce que la rétention garde encore —
 * soit jusqu'à quarante parties par joueur, dont celles déjà annoncées une à
 * une juste avant le basculement. Le mode et sa borne sont une seule décision,
 * ils ne doivent pas pouvoir diverger.
 */
export function setReportMode(
  guildId: string,
  ladderId: string,
  mode: ReportMode,
): boolean {
  const res = getDb()
    .prepare(
      `UPDATE ladder_discord_guilds
          SET report_mode = ?,
              last_digest_at = CASE WHEN ? = 'resume-soiree' THEN ? ELSE last_digest_at END
        WHERE guild_id = ? AND ladder_id = ?`,
    )
    .run(mode, mode, Date.now(), guildId, ladderId);
  return res.changes > 0;
}

/**
 * Les liaisons en résumé de soirée qui ont un salon où poster.
 *
 * Le balayage des résumés part de là, et non de la file `game_events` : un
 * résumé ne se déclenche pas sur un événement mais sur un **silence**, et
 * aucune ligne n'arrive pour signaler qu'une soirée vient de se terminer.
 */
export function listDigestLinks(): GuildLinkWithLadder[] {
  return getDb()
    .prepare<[], JoinedRow>(
      `${SELECT_JOINED}
        WHERE g.report_mode = 'resume-soiree' AND g.report_channel_id IS NOT NULL
        ORDER BY g.id`,
    )
    .all()
    .map(joinedFromRow);
}

/**
 * Avance la borne des résumés après un envoi réussi.
 *
 * Écrit **après** l'envoi, jamais avant : un échec doit laisser la soirée à
 * couvrir, quitte à la reposter au balayage suivant. Le risque symétrique — un
 * doublon si l'envoi passe et que l'écriture échoue — n'existe pas ici,
 * better-sqlite3 étant synchrone et la ligne déjà verrouillée.
 */
export function markDigestSent(linkId: number, jusqua: number): void {
  getDb()
    .prepare("UPDATE ladder_discord_guilds SET last_digest_at = ? WHERE id = ?")
    .run(jusqua, linkId);
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
