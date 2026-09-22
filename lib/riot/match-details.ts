import { championKey, championLabel } from "@/lib/champions";
import { hasMatchDetail, saveMatchDetail } from "@/lib/db/match-details";
import type { MatchDetail, MatchParticipantDetail, Region, RuneSelection } from "@/lib/types";
import { match, matchTimeline, type MatchDto, type MatchTimelineDto } from "./client";
import { durationSeconds, toRole } from "./match-mapping";

/**
 * Détail complet d'une partie — scoreboard des 10 joueurs, build, runes,
 * courbe d'or. Appelé uniquement pour les 5 parties les plus récentes d'un
 * compte suivi (voir `sync.ts`), et jamais deux fois pour le même match :
 * `hasMatchDetail` sert de garde avant tout appel réseau, ce qui fait qu'un
 * lobby partagé par plusieurs comptes suivis — d'un même ladder ou de deux
 * ladders différents — n'est fetché qu'une fois.
 */
export async function ensureMatchDetail(
  region: Region,
  matchId: string,
  dto?: MatchDto | null,
): Promise<void> {
  if (hasMatchDetail(matchId)) return;

  const full = dto ?? (await match(region, matchId));
  if (!full) return; // partie introuvable côté Riot (rare) : rien à mettre en cache.

  const timeline = await matchTimeline(region, matchId);
  saveMatchDetail(toMatchDetail(full, timeline));
}

function toRuneSelection(perks: MatchDto["info"]["participants"][number]["perks"]): RuneSelection {
  const primary = perks.styles.find((s) => s.description === "primaryStyle") ?? perks.styles[0];
  const sub = perks.styles.find((s) => s.description === "subStyle") ?? perks.styles[1];
  return {
    primaryStyle: primary?.style ?? 0,
    subStyle: sub?.style ?? 0,
    selections: [
      ...(primary?.selections.map((s) => s.perk) ?? []),
      ...(sub?.selections.map((s) => s.perk) ?? []),
    ],
    shards: [perks.statPerks.offense, perks.statPerks.flex, perks.statPerks.defense],
  };
}

function toParticipantDetail(
  p: MatchDto["info"]["participants"][number],
): MatchParticipantDetail {
  return {
    participantId: p.participantId,
    puuid: p.puuid,
    gameName: p.riotIdGameName ?? "Invocateur inconnu",
    tagLine: p.riotIdTagline ?? "",
    teamId: p.teamId as 100 | 200,
    championId: championKey(p.championName),
    championName: championLabel(p.championName),
    role: toRole(p.teamPosition, p.individualPosition),
    win: p.win,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    visionScore: p.visionScore,
    champLevel: p.champLevel,
    goldEarned: p.goldEarned,
    damageDealt: p.totalDamageDealtToChampions,
    damageTaken: p.totalDamageTaken,
    summoner1Id: p.summoner1Id,
    summoner2Id: p.summoner2Id,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    runes: toRuneSelection(p.perks),
  };
}

/** Un point par minute : or cumulé de chaque équipe, tel que servi au client. */
function toGoldTimeline(
  dto: MatchDto,
  timeline: MatchTimelineDto | null,
): MatchDetail["goldTimeline"] {
  if (!timeline) return [];

  const teamByParticipant = new Map(
    dto.info.participants.map((p) => [p.participantId, p.teamId]),
  );

  return timeline.info.frames.map((frame, minute) => {
    let blueGold = 0;
    let redGold = 0;
    for (const raw of Object.values(frame.participantFrames)) {
      const team = teamByParticipant.get(raw.participantId);
      if (team === 100) blueGold += raw.totalGold;
      else if (team === 200) redGold += raw.totalGold;
    }
    return { minute, blueGold, redGold };
  });
}

function toMatchDetail(dto: MatchDto, timeline: MatchTimelineDto | null): MatchDetail {
  const seconds = durationSeconds(dto.info);
  return {
    id: dto.metadata.matchId,
    queueId: dto.info.queueId,
    gameVersion: dto.info.gameVersion,
    durationSec: seconds,
    startedAt: dto.info.gameStartTimestamp,
    endedAt: dto.info.gameEndTimestamp ?? dto.info.gameStartTimestamp + seconds * 1000,
    goldTimeline: toGoldTimeline(dto, timeline),
    participants: dto.info.participants.map(toParticipantDetail),
  };
}
