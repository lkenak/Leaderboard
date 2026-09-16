import type { Tier } from "@/lib/types";

/**
 * La direction artistique, en littéraux.
 *
 * satori — le moteur derrière `ImageResponse` — ne fait tourner ni Tailwind,
 * ni la cascade CSS : pas de `var()`, pas de `color-mix()`, pas de classe
 * utilitaire. Les cartes ne peuvent donc pas lire `@theme` de
 * `app/globals.css`, elles ont besoin des valeurs.
 *
 * Ce fichier en est la **transcription**, et `scripts/check-card-tokens.mjs`
 * (branché en `prebuild`) casse le build dès que les deux divergent. C'est ce
 * qui tient la ressemblance dans le temps : aucune ligne de rendu n'est
 * partagée avec le site — `components/ui/*` sont des composants client, en
 * classes Tailwind, avec `next/image` et CSS grid, dont rien n'existe sous
 * satori. La duplication visuelle est structurelle ; seul le garde-fou la
 * rend sûre.
 *
 * Règle de correspondance attendue par le vérificateur :
 *   --color-panel-2   → COLOR.panel2
 *   --color-acid-ink  → COLOR.acidInk
 *   --color-t-emerald → TIER_COLOR.EMERALD
 *   --radius-md       → RADIUS.md
 *   --text-num        → TEXT.num       (en px, donc rem × 16)
 */

/* ── Couleurs ─────────────────────────────────────────────────────────────── */

export const COLOR = {
  // Supports, du plus profond au plus élevé.
  void: "#05060a",
  base: "#0a0b10",
  panel: "#0d0f14",
  panel2: "#12141b",
  panel3: "#171a22",
  panel4: "#1e222c",

  // Filets — décoratifs, jamais porteurs de texte.
  hair: "rgba(255, 255, 255, 0.06)",
  hair2: "rgba(255, 255, 255, 0.1)",
  hair3: "rgba(255, 255, 255, 0.16)",

  // Rampe d'encre — quatre crans, tous AA sur les supports du site.
  ink: "#f2f4f7",
  ink2: "#a8afbc",
  ink3: "#8b93a2",
  ink4: "#7a8291",

  // Signaux. Trois, jamais plus.
  acid: "#e9ff1f",
  acid2: "#dfff00",
  acidInk: "#0a0b10",
  blaze: "#ff2d55",
  blaze2: "#ff5a6e",
  sky: "#7dd3fc",
  gold: "#c8aa6e",
} as const;

/**
 * Teintes de palier. `lib/lol.ts::tierColorVar()` renvoie `var(--color-t-…)`,
 * inutilisable ici — d'où cette table, et l'entrée `UNRANKED` que le CSS
 * n'a pas besoin de nommer parce qu'il n'affiche alors pas de couleur.
 */
export const TIER_COLOR: Record<Tier | "UNRANKED", string> = {
  IRON: "#8d8b88",
  BRONZE: "#a5764c",
  SILVER: "#9facb5",
  GOLD: "#d7a94b",
  PLATINUM: "#4fbfae",
  EMERALD: "#3fbf6f",
  DIAMOND: "#5a9dfa",
  MASTER: "#b26bd8",
  GRANDMASTER: "#e0524f",
  CHALLENGER: "#f0d68a",
  UNRANKED: COLOR.ink4,
};

/* ── Typographie ──────────────────────────────────────────────────────────── */

/**
 * Les noms passés à satori dans `lib/cards/fonts.ts`. Les mêmes chaînes que
 * `--font-sans` / `--font-mono`, sans la pile de repli : satori n'a que ce
 * qu'on lui donne, un nom inconnu ne dégrade pas, il ne dessine rien.
 */
export const FONT = {
  sans: "General Sans",
  mono: "IBM Plex Mono",
} as const;

/** L'échelle du site, en px (les rem de `@theme` × 16). */
export const TEXT = {
  mega: 56,
  title: 32,
  sub: 18,
  name: 15,
  body: 14,
  num: 14,
  micro: 11,
  nano: 10,
} as const;

export const RADIUS = { xs: 2, sm: 3, md: 5, lg: 8 } as const;

/* ── Utilitaires transposés ───────────────────────────────────────────────── */

/**
 * `.label` — mono, capitales, interlettrage 0.14em.
 *
 * satori veut des px : 0.14em est donc recalculé à chaque taille, et non figé
 * une fois pour toutes.
 */
export function label(size: number, color: string = COLOR.ink3) {
  return {
    fontFamily: FONT.mono,
    fontSize: size,
    fontWeight: 500,
    letterSpacing: size * 0.14,
    color,
  } as const;
}

/** `.num` — mono, chiffres à chasse fixe. */
export function num(size: number, weight: 400 | 500 | 600 = 600, color: string = COLOR.ink) {
  return {
    fontFamily: FONT.mono,
    fontSize: size,
    fontWeight: weight,
    fontVariantNumeric: "tabular-nums",
    color,
  } as const;
}

/**
 * Remplace `ring-1 ring-hair` : satori ne connaît pas `outline`, mais rend
 * correctement les ombres internes.
 */
export function ring(color: string = COLOR.hair, width = 1) {
  return `inset 0 0 0 ${width}px ${color}`;
}

/**
 * Capitales. `textTransform: "uppercase"` fonctionne sous satori, mais passe
 * mal les accents selon la police ; `toLocaleUpperCase("fr")` donne un « É »
 * fiable, et la carte est de toute façon composée en JS.
 */
export function caps(s: string): string {
  return s.toLocaleUpperCase("fr");
}
