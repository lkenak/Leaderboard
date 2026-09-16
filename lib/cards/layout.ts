/**
 * Géométrie propre aux cartes — ce qui n'existe que pour l'image et n'a rien
 * à faire dans le CSS du site (qui a ses breakpoints et son flux).
 *
 * Séparé de `tokens.ts` pour une raison mécanique : `tokens.ts` est sous
 * garde-fou (`scripts/check-card-tokens.mjs`) et doit rester le reflet exact
 * de `@theme`. Une hauteur de ligne de 66 px n'existe nulle part dans
 * `globals.css` ; la mettre là ferait échouer le vérificateur.
 */

/**
 * Discord affiche une image en ligne sur ~550 px de large sur ordinateur, et
 * sur la largeur de la bulle sur mobile (~400-430 dp). On dessine donc au
 * double de la taille de lecture : net sur les écrans à forte densité, et
 * l'échelle du site reste la référence (`TEXT.name` 15 → 30 sur une carte).
 */
export const SCALE = 2;

/** Applique l'échelle des cartes à une valeur de l'échelle du site. */
export function s(value: number): number {
  return value * SCALE;
}

export const LADDER_CARD = {
  width: 1200,
  headerHeight: 120,
  rowHeight: 66,
  footerHeight: 84,
  padX: 40,
  /** Au-delà, la carte est illisible une fois réduite par Discord. */
  maxRows: 12,
  /** Colonnes, en x depuis le bord gauche. */
  col: {
    position: 40,
    positionDelta: 96,
    avatar: 140,
    name: 200,
    crest: 580,
    lp: 636,
    winrate: 780,
    session: 940,
    form: 1080,
  },
} as const;

export function ladderCardHeight(rows: number): number {
  return LADDER_CARD.headerHeight + LADDER_CARD.rowHeight * rows + LADDER_CARD.footerHeight;
}

export const PLAYER_CARD = { width: 900, height: 460, padX: 40 } as const;

export const LOBBY_CARD = {
  width: 900,
  headerHeight: 200,
  rowHeight: 52,
  footerHeight: 76,
  padX: 40,
} as const;

export const GAME_CARD = { width: 1000, height: 420, padX: 40 } as const;
