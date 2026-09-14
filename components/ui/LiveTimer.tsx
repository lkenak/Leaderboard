"use client";

import { useClock } from "@/lib/clock";
import { duration } from "@/lib/format";

/**
 * Chronomètre d'une partie en cours. Il s'abonne à l'horloge partagée au pas
 * d'une seconde : faire battre l'horloge de la page entière à cette fréquence
 * re-rendrait les trente lignes du classement pour animer quatre cellules.
 */
export function LiveTimer({
  startedAt,
  serverNow,
}: {
  startedAt: number;
  serverNow: number;
}) {
  const now = useClock(1000, serverNow);
  return <>{duration(Math.max(0, Math.floor((now - startedAt) / 1000)))}</>;
}
