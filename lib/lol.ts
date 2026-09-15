import { DDRAGON_VERSION } from "./champions";
import {
  APEX_TIERS,
  DIVISIONS,
  TIERS,
  type Division,
  type RankSnapshot,
  type Role,
  type Tier,
} from "./types";

/**
 * LP absolus : une seule échelle continue de Fer IV à Challenger, pour trier
 * un classement qui mélange les paliers sans cas particulier dans les vues.
 *
 * Chaque palier vaut 400 LP (4 divisions × 100). Maître, Grand Maître et
 * Challenger partagent la même base : au-dessus de Diamant I, seul le LP
 * compte, exactement comme en jeu.
 */
const TIER_BASE: Record<Tier, number> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 2800,
  CHALLENGER: 2800,
};

const DIVISION_OFFSET: Record<Division, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300,
};

export function isApex(tier: Tier): boolean {
  return APEX_TIERS.includes(tier);
}

export function absoluteLp(rank: RankSnapshot): number {
  const base = TIER_BASE[rank.tier];
  if (isApex(rank.tier)) return base + rank.leaguePoints;
  const div = rank.division ?? "IV";
  return base + DIVISION_OFFSET[div] + rank.leaguePoints;
}

/** Opération inverse : utile pour convertir un pic de LP en palier lisible. */
export function rankFromAbsoluteLp(lp: number): RankSnapshot {
  const clamped = Math.max(0, lp);
  if (clamped >= TIER_BASE.MASTER) {
    const over = clamped - TIER_BASE.MASTER;
    const tier: Tier =
      over >= 1000 ? "CHALLENGER" : over >= 500 ? "GRANDMASTER" : "MASTER";
    return { tier, division: null, leaguePoints: over, wins: 0, losses: 0 };
  }
  const tierIndex = Math.min(6, Math.floor(clamped / 400));
  const tier = TIERS[tierIndex];
  const within = clamped - tierIndex * 400;
  const division = DIVISIONS[Math.min(3, Math.floor(within / 100))];
  return {
    tier,
    division,
    leaguePoints: within % 100,
    wins: 0,
    losses: 0,
  };
}

const TIER_LABEL: Record<Tier, string> = {
  IRON: "Fer",
  BRONZE: "Bronze",
  SILVER: "Argent",
  GOLD: "Or",
  PLATINUM: "Platine",
  EMERALD: "Émeraude",
  DIAMOND: "Diamant",
  MASTER: "Maître",
  GRANDMASTER: "Grand Maître",
  CHALLENGER: "Challenger",
};

/** Forme courte pour les cellules étroites : « D1 », « GM », « E4 ». */
const TIER_SHORT: Record<Tier, string> = {
  IRON: "F",
  BRONZE: "B",
  SILVER: "A",
  GOLD: "O",
  PLATINUM: "P",
  EMERALD: "E",
  DIAMOND: "D",
  MASTER: "M",
  GRANDMASTER: "GM",
  CHALLENGER: "CH",
};

export function tierLabel(tier: Tier): string {
  return TIER_LABEL[tier];
}

export function rankLabel(rank: RankSnapshot): string {
  if (isApex(rank.tier)) return TIER_LABEL[rank.tier];
  return `${TIER_LABEL[rank.tier]} ${rank.division}`;
}

export function rankShort(rank: RankSnapshot): string {
  if (isApex(rank.tier)) return TIER_SHORT[rank.tier];
  const n = DIVISIONS.indexOf(rank.division ?? "IV");
  return `${TIER_SHORT[rank.tier]}${4 - n}`;
}

/** Couleur de palier — variable CSS, pour rester cohérent avec les emblèmes. */
export function tierColorVar(tier: Tier): string {
  return `var(--color-t-${tier.toLowerCase()})`;
}

export function crestSrc(tier: Tier | "UNRANKED"): string {
  return `/lol/crests/${tier.toLowerCase()}.svg`;
}

/**
 * Grand emblème de palier, en PNG. Plus aucun composant ne l'utilise : le
 * filigrane des cartes du podium est passé au crest SVG, qui porte le même
 * visuel sans pouvoir se déformer et pèse 4 Ko au lieu de 225.
 *
 * L'accesseur et les assets sont conservés le temps d'un arbitrage visuel — le
 * PNG est plus détaillé que le vecteur, et le rendu du filigrane n'a pas pu
 * être comparé à l'œil. Si l'on y revient, deux précautions, faute desquelles
 * le défaut d'origine reparaît : ces images sont en 16:9 (1280×720, parfois
 * 2560×1440) et leur emblème utile n'occupe que ~22 % du canevas. Il faut donc
 * `object-contain` **et** une boîte au bon ratio — jamais `size-[…]` carré,
 * qui les écrase en largeur. Sinon, supprimer cette fonction et
 * `public/lol/emblems/` (1,1 Mo).
 */
export function emblemSrc(tier: Tier): string {
  return `/lol/emblems/${tier.toLowerCase()}.png`;
}

export function championSrc(championId: string): string {
  return `/lol/champions/${championId}.png`;
}

/**
 * Icône de profil, servie par Data Dragon.
 *
 * C'est le seul asset qu'on ne pré-embarque pas : les identifiants d'icônes se
 * comptent en milliers et dépendent du compte réel de chaque joueur, alors que
 * les emblèmes, les postes et les 173 champions forment des ensembles finis
 * qu'on peut héberger. Le navigateur la met en cache, et `Avatar` prévoit
 * l'échec de chargement.
 */
export function profileIconSrc(id: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`;
}

const ROLE_FILE: Record<Role, string> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "middle",
  BOTTOM: "bottom",
  UTILITY: "utility",
};

export function roleSrc(role: Role): string {
  return `/lol/roles/${ROLE_FILE[role]}.svg`;
}

const ROLE_LABEL: Record<Role, string> = {
  TOP: "Toplane",
  JUNGLE: "Jungle",
  MIDDLE: "Midlane",
  BOTTOM: "Botlane",
  UTILITY: "Support",
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

/** Les paliers retenus pour le filtre : ceux qui peuplent réellement un top. */
export const FILTERABLE_TIERS: Tier[] = [
  "CHALLENGER",
  "GRANDMASTER",
  "MASTER",
  "DIAMOND",
  "EMERALD",
  "PLATINUM",
];
