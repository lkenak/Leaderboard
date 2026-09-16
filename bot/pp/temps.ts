/**
 * Interprétation de « 21h30 » et « demain ».
 *
 * Repris de `Organisation PP/src/lib/time.ts`, avec deux corrections.
 *
 * **Le résultat est un instant en millisecondes**, pas une chaîne. L'ancien
 * bot stockait `toISOString()` (donc de l'UTC) et le comparait ailleurs à des
 * dates construites en local : selon la saison, les rappels partaient une ou
 * deux heures à côté, sans que rien ne le signale.
 *
 * **La construction reste locale**, et c'est voulu : quand quelqu'un tape
 * « 21h30 », il parle de son heure, pas d'UTC. Le processus tourne sous
 * `TZ=Europe/Paris` (réglé dans `/etc/leaderboard.env`) — c'est la seule
 * dépendance de ce fichier, et si cette variable saute, toutes les PP décalent
 * ensemble. C'est le seul endroit où le fuseau peut entrer dans le système :
 * partout ailleurs on manipule des millisecondes.
 */

export interface HeureAnalysee {
  /** L'instant, en ms. */
  startsAt: number;
  /** Ce que la personne a tapé, normalisé pour l'affichage. */
  heureLabel: string;
  dateLabel: string;
}

const HEURE = /^(\d{1,2})\s*[h:]\s*(\d{0,2})$/i;
const JOUR = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;

export function analyserHeure(heure: string, dateBrute: string): HeureAnalysee | null {
  const m = HEURE.exec(heure.trim());
  if (!m) return null;

  const heures = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  if (heures > 23 || minutes > 59) return null;

  const base = new Date();
  const dl = dateBrute.trim().toLowerCase();
  let dateLabel = "aujourd'hui";

  if (dl === "demain") {
    base.setDate(base.getDate() + 1);
    dateLabel = "demain";
  } else if (dl !== "aujourd'hui" && dl !== "aujourdhui" && dl !== "") {
    const d = JOUR.exec(dl);
    if (!d) return null;
    const jour = Number(d[1]);
    const mois = Number(d[2]) - 1;
    const annee = d[3]
      ? d[3].length === 2
        ? 2000 + Number(d[3])
        : Number(d[3])
      : base.getFullYear();
    base.setFullYear(annee, mois, jour);
    dateLabel = `${String(jour).padStart(2, "0")}/${String(mois + 1).padStart(2, "0")}`;
  }

  base.setHours(heures, minutes, 0, 0);

  // « 21h » tapé à 22h désigne demain, pas une heure déjà passée. Seulement
  // quand la date est implicite : si quelqu'un a écrit une date explicite,
  // même passée, c'est son choix et on ne le corrige pas.
  if (dateLabel === "aujourd'hui" && base.getTime() < Date.now()) {
    base.setDate(base.getDate() + 1);
    dateLabel = "demain";
  }

  return {
    startsAt: base.getTime(),
    heureLabel: `${heures}h${minutes > 0 ? String(minutes).padStart(2, "0") : ""}`,
    dateLabel,
  };
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janv.", "févr.", "mars", "avril", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** « jeu. 18 sept. · 21:00 » — toujours absolu, jamais « dans 2 h ». */
export function libelleInstant(ts: number): string {
  const d = new Date(ts);
  const jour = JOURS[d.getDay()].slice(0, 3);
  const heure = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${jour}. ${d.getDate()} ${MOIS[d.getMonth()]} · ${heure}`;
}
