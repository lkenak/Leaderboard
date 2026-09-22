import type { MatchDetail, MatchParticipantDetail, Role, RuneSelection } from "@/lib/types";
import { getDb } from "./client";

/**
 * Cache de détail de partie — scoreboard des 10 joueurs, build, runes, courbe
 * d'or. Voir db/migrations/0008_match_details.sql pour le principe : un match
 * est stocké **une seule fois**, partagé entre tous les comptes suivis qui y
 * ont joué (même lobby, ou lobby commun à deux ladders différents).
 */

interface MatchRow {
  id: string;
  queue_id: number;
  game_version: string;
  duration_sec: number;
  started_at: number;
  ended_at: number;
  gold_timeline: string;
}

interface ParticipantRow {
  match_id: string;
  participant_id: number;
  puuid: string;
  game_name: string;
  tag_line: string;
  team_id: number;
  champion_id: string;
  champion_name: string;
  role: string;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  vision_score: number;
  champ_level: number;
  gold_earned: number;
  damage_dealt: number;
  damage_taken: number;
  summoner1_id: number;
  summoner2_id: number;
  items_json: string;
  perks_json: string;
}

function participantFromRow(row: ParticipantRow): MatchParticipantDetail {
  return {
    participantId: row.participant_id,
    puuid: row.puuid,
    gameName: row.game_name,
    tagLine: row.tag_line,
    teamId: row.team_id as 100 | 200,
    championId: row.champion_id,
    championName: row.champion_name,
    role: row.role as Role,
    win: row.win === 1,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    cs: row.cs,
    visionScore: row.vision_score,
    champLevel: row.champ_level,
    goldEarned: row.gold_earned,
    damageDealt: row.damage_dealt,
    damageTaken: row.damage_taken,
    summoner1Id: row.summoner1_id,
    summoner2Id: row.summoner2_id,
    items: JSON.parse(row.items_json) as number[],
    runes: JSON.parse(row.perks_json) as RuneSelection,
  };
}

export function hasMatchDetail(matchId: string): boolean {
  const row = getDb()
    .prepare<[string], { present: number }>(
      "SELECT 1 AS present FROM matches WHERE id = ?",
    )
    .get(matchId);
  return row !== undefined;
}

export function getMatchDetail(matchId: string): MatchDetail | null {
  const db = getDb();
  const match = db
    .prepare<[string], MatchRow>("SELECT * FROM matches WHERE id = ?")
    .get(matchId);
  if (!match) return null;

  const participants = db
    .prepare<[string], ParticipantRow>(
      "SELECT * FROM match_participants WHERE match_id = ? ORDER BY participant_id ASC",
    )
    .all(matchId)
    .map(participantFromRow);

  return {
    id: match.id,
    queueId: match.queue_id,
    gameVersion: match.game_version,
    durationSec: match.duration_sec,
    startedAt: match.started_at,
    endedAt: match.ended_at,
    goldTimeline: JSON.parse(match.gold_timeline) as MatchDetail["goldTimeline"],
    participants,
  };
}

/** Une transaction : soit le match et ses 10 participants sont là, soit rien. */
export function saveMatchDetail(detail: MatchDetail): void {
  const db = getDb();
  const insertMatch = db.prepare(
    `INSERT OR IGNORE INTO matches
       (id, queue_id, game_version, duration_sec, started_at, ended_at, gold_timeline, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertParticipant = db.prepare(
    `INSERT OR IGNORE INTO match_participants
       (match_id, participant_id, puuid, game_name, tag_line, team_id, champion_id, champion_name,
        role, win, kills, deaths, assists, cs, vision_score, champ_level, gold_earned,
        damage_dealt, damage_taken, summoner1_id, summoner2_id, items_json, perks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const run = db.transaction(() => {
    insertMatch.run(
      detail.id,
      detail.queueId,
      detail.gameVersion,
      detail.durationSec,
      detail.startedAt,
      detail.endedAt,
      JSON.stringify(detail.goldTimeline),
      Date.now(),
    );
    for (const p of detail.participants) {
      insertParticipant.run(
        detail.id,
        p.participantId,
        p.puuid,
        p.gameName,
        p.tagLine,
        p.teamId,
        p.championId,
        p.championName,
        p.role,
        p.win ? 1 : 0,
        p.kills,
        p.deaths,
        p.assists,
        p.cs,
        p.visionScore,
        p.champLevel,
        p.goldEarned,
        p.damageDealt,
        p.damageTaken,
        p.summoner1Id,
        p.summoner2Id,
        JSON.stringify(p.items),
        JSON.stringify(p.runes),
      );
    }
  });
  run.immediate();
}

/**
 * Retire les matchs détaillés qui ne sont plus dans le top 5 (par `ended_at`)
 * d'aucun puuid présent dans `games`. C'est ce qui garde un match partagé par
 * deux joueurs du même lobby tant qu'au moins l'un des deux le compte encore
 * parmi ses 5 dernières parties, et le purge dès que plus aucun ne le fait —
 * sans registre de propriété séparé à maintenir.
 */
export function pruneMatchDetails(): number {
  return getDb()
    .prepare(
      `DELETE FROM matches WHERE id NOT IN (
         SELECT match_id FROM (
           SELECT g.id AS match_id,
                  ROW_NUMBER() OVER (PARTITION BY g.puuid ORDER BY g.ended_at DESC) AS rn
           FROM games g
         ) WHERE rn <= 5
       )`,
    )
    .run().changes;
}
