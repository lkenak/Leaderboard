import type { Role } from "@/lib/types";
import { ROLES } from "@/lib/types";
import type { MatchDto } from "./client";

/**
 * Petites conversions partagées entre `sync.ts` (résumé pour le compte suivi)
 * et `match-details.ts` (détail des 10 joueurs), pour ne pas les dupliquer ni
 * créer de dépendance circulaire entre les deux.
 */

export function toRole(teamPosition: string, individualPosition: string): Role {
  const raw = (teamPosition || individualPosition || "").toUpperCase();
  return (ROLES as readonly string[]).includes(raw) ? (raw as Role) : "MIDDLE";
}

/**
 * `gameDuration` change d'unité selon les patchs : en secondes dès que
 * `gameEndTimestamp` est présent, en millisecondes avant. Riot documente la
 * bascule, et s'y fier évite d'afficher des parties de 37 000 minutes.
 */
export function durationSeconds(info: MatchDto["info"]): number {
  return info.gameEndTimestamp !== undefined
    ? info.gameDuration
    : Math.round(info.gameDuration / 1000);
}
