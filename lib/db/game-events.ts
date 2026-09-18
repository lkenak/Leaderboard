import { getDb } from "./client";

/**
 * La file des parties terminées, entre la synchronisation Riot qui les
 * découvre et le bot Discord qui les annonce.
 *
 * Deux processus, une table : c'est ce qui rend l'annonce durable. Le bot
 * peut redémarrer, Discord peut tomber — les lignes attendent, et repartent
 * au balayage suivant.
 */

export interface GameEvent {
  id: number;
  puuid: string;
  matchId: string;
  endedAt: number;
  createdAt: number;
  attempts: number;
}

interface Row {
  id: number;
  puuid: string;
  match_id: string;
  ended_at: number;
  created_at: number;
  attempts: number;
}

const fromRow = (r: Row): GameEvent => ({
  id: r.id,
  puuid: r.puuid,
  matchId: r.match_id,
  endedAt: r.ended_at,
  createdAt: r.created_at,
  attempts: r.attempts,
});

/**
 * Au-delà, on renonce. Une partie qui échoue cinq fois échoue pour une raison
 * qui ne passera pas toute seule, et la réessayer indéfiniment remplit le
 * journal sans rien accomplir.
 */
export const TENTATIVES_MAX = 5;

/** Les événements qui attendent, les plus anciens d'abord. */
export function pendingGameEvents(limite = 50): GameEvent[] {
  return getDb()
    .prepare<[number], Row>(
      `SELECT id, puuid, match_id, ended_at, created_at, attempts
         FROM game_events WHERE processed_at IS NULL
        ORDER BY created_at ASC LIMIT ?`,
    )
    .all(limite)
    .map(fromRow);
}

/** Traité — envoyé, ou abandonné pour de bon. Ne reviendra pas. */
export function markEventProcessed(id: number, erreur: string | null = null): void {
  getDb()
    .prepare("UPDATE game_events SET processed_at = ?, last_error = ? WHERE id = ?")
    .run(Date.now(), erreur, id);
}

/** Échec temporaire : on recompte et on réessaiera. */
export function markEventFailed(id: number, erreur: string): void {
  getDb()
    .prepare("UPDATE game_events SET attempts = attempts + 1, last_error = ? WHERE id = ?")
    .run(erreur, id);
}

/**
 * Repousse un événement sans consommer de tentative.
 *
 * Sert au seul cas légitime d'attente : le delta de LP n'est pas encore
 * connu. `fillLpDeltas` le remplira peut-être au cycle suivant, et poster
 * « — LP » alors qu'on saura la valeur dans deux minutes serait dommage.
 */
export function delayEvent(id: number, deMs: number): void {
  getDb()
    .prepare("UPDATE game_events SET created_at = ? WHERE id = ?")
    .run(Date.now() + deMs, id);
}

/* ── Idempotence des envois ───────────────────────────────────────────────── */

export interface Reservation {
  /** `true` si c'est nous qui venons de réserver, `false` si déjà posté. */
  nouveau: boolean;
  /** L'identifiant du message déjà posté, le cas échéant. */
  messageId: string | null;
}

/**
 * Réserve l'envoi d'une partie dans un salon, avant de l'envoyer.
 *
 * Cinq joueurs d'un même ladder dans la même partie produisent cinq
 * événements. Le premier réserve et poste ; les quatre autres retrouvent la
 * réservation et éditent le message existant plutôt que d'en empiler cinq.
 */
export function reserverEnvoi(
  channelId: string,
  matchId: string,
  guildId: string,
  ladderId: string,
): Reservation {
  const db = getDb();
  const res = db
    .prepare(
      `INSERT INTO discord_game_posts (channel_id, match_id, guild_id, ladder_id, sent_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, match_id) DO NOTHING`,
    )
    .run(channelId, matchId, guildId, ladderId, Date.now());

  if (res.changes > 0) return { nouveau: true, messageId: null };

  const existant = db
    .prepare<[string, string], { message_id: string | null }>(
      "SELECT message_id FROM discord_game_posts WHERE channel_id = ? AND match_id = ?",
    )
    .get(channelId, matchId);
  return { nouveau: false, messageId: existant?.message_id ?? null };
}

export function enregistrerMessage(
  channelId: string,
  matchId: string,
  messageId: string,
): void {
  getDb()
    .prepare(
      "UPDATE discord_game_posts SET message_id = ? WHERE channel_id = ? AND match_id = ?",
    )
    .run(messageId, channelId, matchId);
}

/**
 * Libère une réservation dont l'envoi a échoué.
 *
 * Sans ça, la réservation bloquerait à jamais la nouvelle tentative : le
 * prochain passage croirait le message déjà posté et n'en enverrait aucun.
 */
export function libererReservation(channelId: string, matchId: string): void {
  getDb()
    .prepare(
      "DELETE FROM discord_game_posts WHERE channel_id = ? AND match_id = ? AND message_id IS NULL",
    )
    .run(channelId, matchId);
}

/* ── Entretien ────────────────────────────────────────────────────────────── */

/** Purge les traces anciennes : au-delà d'une semaine, plus personne ne relit. */
export function purgerAnciensEvenements(ageMs = 7 * 24 * 3600_000): number {
  const db = getDb();
  const avant = Date.now() - ageMs;
  const a = db.prepare("DELETE FROM game_events WHERE created_at < ?").run(avant).changes;
  const b = db.prepare("DELETE FROM discord_game_posts WHERE sent_at < ?").run(avant).changes;
  return a + b;
}
