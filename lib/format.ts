/** Formatage — une seule source de vérité pour les signes, les LP et le temps. */

export function signed(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `${n}`;
}

export function lpLabel(n: number): string {
  return `${n} LP`;
}

/** Séparateur d'espace fine insécable, comme en typographie française. */
export function thousands(n: number): string {
  return n.toLocaleString("fr-FR").replace(/ |\s/g, " ");
}

export function winratePct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}

export function kda(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return kills + assists;
  return (kills + assists) / deaths;
}

export function kdaLabel(value: number): string {
  return value.toFixed(2);
}

export function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * « il y a … » en français, volontairement laconique : un tableau de 30 lignes
 * n'a pas la place pour « il y a environ 3 heures ».
 */
export function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} j`;
  return `${Math.floor(d / 7)} sem.`;
}

/**
 * Libellé relatif prêt à afficher. `relativeTime` renvoie une durée nue ;
 * seule une durée se préfixe de « il y a », pas « à l'instant ».
 */
export function agoLabel(ts: number, now: number): string {
  const rel = relativeTime(ts, now);
  return rel === "à l'instant" ? rel : `il y a ${rel}`;
}

export function clockTime(ts: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export function shortDate(ts: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(ts);
}
