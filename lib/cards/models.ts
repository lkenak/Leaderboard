import { clockTime, kdaLabel, shortDate, winratePct } from "@/lib/format";
import { championSrc, rankFromAbsoluteLp, rankLabel, rankShort } from "@/lib/lol";
import type { RankingEntry, RankingSnapshot, Role, Tier } from "@/lib/types";
import { asset } from "./assets";
import { LADDER_CARD } from "./layout";
import { profileIconDataUri } from "./profile-icons";

/**
 * Le modèle de vue des cartes : ce que la carte dessine, ce que le texte
 * alternatif décrit, et ce que l'embed de repli affiche.
 *
 * **Un seul modèle, trois consommateurs.** C'est ce qui rend l'option « tout
 * en image » sûre : si le rendu échoue ou déborde son délai, `fallback.ts`
 * produit un embed à partir des mêmes données, et personne ne reçoit une
 * erreur à la place de son classement.
 *
 * Toutes les fonctions d'ici sont pures — elles ne lisent ni la base, ni le
 * réseau, ni l'horloge (l'instant est passé en argument).
 */

export interface LadderRowModel {
  position: number;
  positionDelta: number | null;
  name: string;
  tag: string;
  tier: Tier;
  rankShort: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winrate: number;
  /** La plus récente en dernier — l'ordre d'affichage des barres. */
  form: boolean[];
  live: boolean;
  /**
   * L'icône de profil en data-URI, ou `null` si elle n'est pas encore en
   * cache — la carte retombe alors sur une pastille d'initiale. Le
   * remplissage du cache doit avoir eu lieu **avant** (voir
   * `lib/cards/profile-icons.ts`).
   */
  icon: string | null;
}

export interface LadderCardModel {
  ladderName: string;
  slug: string;
  /**
   * Lien absolu vers le ladder, ou `null` quand `LADDER_PUBLIC_URL` n'est pas
   * configurée. Jamais une URL relative : Discord rejette un embed dont l'URL
   * n'est pas absolue, et c'est alors le message entier qui échoue, pas
   * seulement le lien.
   */
  url: string | null;
  updatedAt: number;
  splitName: string;
  rows: LadderRowModel[];
  /** Nombre de joueurs classés au total, avant la coupe à `maxRows`. */
  total: number;
}

/* ── Construction ─────────────────────────────────────────────────────────── */

function rowFromEntry(entry: RankingEntry): LadderRowModel {
  return {
    position: entry.position,
    // `0` et « inconnu » se dessinent pareil (un tiret), mais on garde la
    // distinction : le jour où l'un des deux mérite autre chose, elle est là.
    positionDelta: entry.positionDelta === 0 ? null : entry.positionDelta,
    name: entry.player.displayName ?? entry.player.gameName,
    tag: entry.player.tagLine,
    tier: entry.rank.tier,
    rankShort: rankShort(entry.rank),
    leaguePoints: entry.rank.leaguePoints,
    wins: entry.rank.wins,
    losses: entry.rank.losses,
    winrate: winratePct(entry.rank.wins, entry.rank.losses),
    // `entry.form` vient la plus récente EN PREMIER (cf. lib/types.ts) ; les
    // barres se lisent de gauche à droite, la plus récente à droite.
    form: [...entry.form].reverse(),
    live: entry.live !== null,
    icon: profileIconDataUri(entry.player.profileIconId || null),
  };
}

export function buildLadderCardModel(
  snapshot: RankingSnapshot,
  options: { ladderName: string; slug: string; publicUrl: string; maxRows?: number },
): LadderCardModel {
  const max = Math.min(options.maxRows ?? 10, LADDER_CARD.maxRows);
  return {
    ladderName: options.ladderName,
    slug: options.slug,
    url: options.publicUrl ? `${options.publicUrl}/l/${options.slug}` : null,
    updatedAt: snapshot.updatedAt,
    splitName: snapshot.splitName,
    rows: snapshot.entries.slice(0, max).map(rowFromEntry),
    total: snapshot.entries.length,
  };
}

/* ── Fiche d'un joueur ────────────────────────────────────────────────────── */

export interface PlayerCardModel {
  name: string;
  tag: string;
  tier: Tier;
  rankLabel: string;
  peakLabel: string;
  leaguePoints: number;
  role: Role;
  wins: number;
  losses: number;
  winrate: number;
  kdaLabel: string;
  /**
   * Bilan 24 h — gardé ici, contrairement à la carte de classement : sur une
   * fiche individuelle c'est l'information du jour.
   */
  sessionLp: number | null;
  sessionWins: number;
  sessionLosses: number;
  sessionGames: number;
  form: boolean[];
  /** `null` en dessous de deux parties : une série de 1 n'est pas une série. */
  streak: { type: "win" | "loss"; count: number } | null;
  champions: Array<{ icon: string }>;
  live: boolean;
  icon: string | null;
  /** Position dans le ladder consulté, `null` si le joueur n'y figure pas. */
  position: number | null;
  total: number;
  ladderName: string | null;
  url: string | null;
  updatedAt: number;
}

export function buildPlayerCardModel(
  entry: RankingEntry | Omit<RankingEntry, "position" | "positionDelta">,
  options: {
    position: number | null;
    total: number;
    ladderName: string | null;
    url: string | null;
    updatedAt: number;
  },
): PlayerCardModel {
  return {
    name: entry.player.displayName ?? entry.player.gameName,
    tag: entry.player.tagLine,
    tier: entry.rank.tier,
    rankLabel: rankLabel(entry.rank),
    peakLabel: rankLabel(rankFromAbsoluteLp(entry.peakAbsoluteLp)),
    leaguePoints: entry.rank.leaguePoints,
    role: entry.player.mainRole,
    wins: entry.rank.wins,
    losses: entry.rank.losses,
    winrate: winratePct(entry.rank.wins, entry.rank.losses),
    kdaLabel: kdaLabel(entry.kda),
    sessionLp: entry.session.lp,
    sessionWins: entry.session.wins,
    sessionLosses: entry.session.losses,
    sessionGames: entry.session.games,
    form: [...entry.form].reverse(),
    streak:
      entry.streak.type !== "none" && entry.streak.count >= 2
        ? { type: entry.streak.type, count: entry.streak.count }
        : null,
    // Trois au plus : au-delà, les vignettes mangent la ligne de statistiques.
    champions: entry.champions.slice(0, 3).map((c) => ({ icon: asset(championSrc(c.championId)) })),
    live: entry.live !== null,
    icon: profileIconDataUri(entry.player.profileIconId || null),
    position: options.position,
    total: options.total,
    ladderName: options.ladderName,
    url: options.url,
    updatedAt: options.updatedAt,
  };
}

/** Texte alternatif de la fiche, pour les lecteurs d'écran. */
export function playerAltText(model: PlayerCardModel): string {
  const morceaux = [
    `Fiche de ${model.name}`,
    model.rankLabel,
    `${model.leaguePoints} LP`,
    `${model.winrate} % de winrate sur ${model.wins + model.losses} parties`,
    `KDA ${model.kdaLabel}`,
  ];
  if (model.position !== null) {
    morceaux.push(`${model.position}e sur ${model.total} dans ${model.ladderName}`);
  }
  if (model.sessionGames > 0) {
    morceaux.push(
      `sur 24 h : ${deltaLabel(model.sessionLp, " LP")}, ` +
        `${model.sessionWins} victoires et ${model.sessionLosses} défaites`,
    );
  }
  if (model.live) morceaux.push("actuellement en jeu");
  return `${morceaux.join(", ")}. Relevé du ${stampLabel(model.updatedAt)}.`;
}

/* ── Textes qui accompagnent l'image ──────────────────────────────────────── */

/** `+24`, `-17`, `—` quand la variation est inconnue. */
export function deltaLabel(value: number | null, suffixe = ""): string {
  if (value === null) return `—${suffixe}`;
  const signe = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${signe}${Math.abs(value)}${suffixe}`;
}

/**
 * Horodatage d'un relevé, toujours **absolu**.
 *
 * Jamais « il y a 3 min » : gravé dans un PNG, un horodatage relatif ment dès
 * la minute suivante dans l'historique Discord, et il ferait exploser la clé
 * de cache du rendu.
 */
export function stampLabel(ts: number): string {
  return `${shortDate(ts)} à ${clockTime(ts)}`;
}

/**
 * Texte alternatif, pour les lecteurs d'écran.
 *
 * Discord le limite à 1024 caractères ; on tronque sur une ligne entière
 * plutôt qu'au milieu d'un pseudo.
 */
export function ladderAltText(model: LadderCardModel): string {
  const tete = `Classement du ladder ${model.ladderName}, relevé du ${stampLabel(model.updatedAt)}.`;
  const lignes = model.rows.map((r) => {
    const morceaux = [
      `${r.position}. ${r.name}`,
      `${r.rankShort} ${r.leaguePoints} LP`,
      `${r.winrate} % de winrate sur ${r.wins + r.losses} parties`,
    ];
    if (r.live) morceaux.push("en jeu");
    return morceaux.join(", ");
  });

  let texte = tete;
  for (const ligne of lignes) {
    if (texte.length + ligne.length + 2 > 1000) break;
    texte += ` ${ligne}.`;
  }
  return texte;
}

/**
 * Résumé visible dans le message.
 *
 * Il sert quand les images sont désactivées ou ne chargent pas, et il rend le
 * message trouvable par la recherche Discord — une image, elle, ne s'indexe
 * pas. Il porte aussi le lien, qu'une image ne peut pas porter.
 */
export function ladderSummary(model: LadderCardModel): string {
  const lienFinal = model.url ? `\n${model.url}` : "";

  if (model.rows.length === 0) {
    return `**${model.ladderName}** — aucun joueur classé pour l'instant.${lienFinal}`;
  }

  const podium = model.rows
    .slice(0, 3)
    .map((r) => `${r.position}. ${r.name} · ${r.rankShort} ${r.leaguePoints} LP · ${r.winrate} %`)
    .join(" · ");

  const reste =
    model.total > model.rows.length ? ` · ${model.total - model.rows.length} autre(s)` : "";

  return (
    `**${model.ladderName}** — relevé du ${stampLabel(model.updatedAt)}\n` +
    `${podium}${reste}${lienFinal}`
  );
}
