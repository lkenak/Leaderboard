import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crestSrc, roleSrc } from "@/lib/lol";
import { ROLES, TIERS } from "@/lib/types";

/**
 * Les images des cartes, en data-URI.
 *
 * satori ne fait aucune requête pour nous, et surtout il ne doit pas en
 * faire : un `fetch` dans le chemin de rendu a une latence non bornée, aucun
 * délai de garde, et échoue en silence. Tout ce qu'une carte affiche est donc
 * lu sur le disque, depuis `public/` — le même dossier que le site, via les
 * mêmes helpers (`crestSrc`, `roleSrc`, `championSrc`, `emblemSrc`), pour que
 * les chemins ne puissent pas diverger.
 *
 * Les crests et les postes sont des SVG, et satori les rend tels quels — il
 * réécrit même `currentColor`. Aucune rastérisation préalable à prévoir.
 *
 * Ce qui n'a PAS sa place ici : `profileIconSrc()`, qui pointe sur Data
 * Dragon. Les icônes de profil passeront par un cache disque alimenté par la
 * synchro Riot (lot 2), jamais par le rendu.
 */

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const cache = new Map<string, string>();

/**
 * `/lol/crests/diamond.svg` → `data:image/svg+xml;base64,…`
 *
 * Prend le chemin public tel que le rendent les helpers de `lib/lol.ts`, pour
 * qu'on écrive `asset(crestSrc(tier))` et non un chemin recopié à la main.
 */
export function asset(publicPath: string): string {
  const hit = cache.get(publicPath);
  if (hit) return hit;

  const ext = publicPath.slice(publicPath.lastIndexOf("."));
  const type = TYPES[ext];
  if (!type) throw new Error(`Type d'image non géré pour les cartes : ${publicPath}`);

  const bytes = readFileSync(join(process.cwd(), "public", publicPath));
  const uri = `data:${type};base64,${bytes.toString("base64")}`;
  cache.set(publicPath, uri);
  return uri;
}

/**
 * Les dimensions intrinsèques d'un PNG, lues dans son en-tête.
 *
 * Existe parce que supposer une image carrée coûte cher : les emblèmes de
 * palier sont en 16:9 (1280×720), et les forcer dans un carré les étirait
 * verticalement de 44 %. Une carte doit calculer sa hauteur depuis le ratio
 * réel, pas depuis une intuition.
 *
 * PNG seulement : la largeur et la hauteur tiennent dans le bloc IHDR, aux
 * octets 16 à 24, toujours. Les SVG n'en ont pas besoin — ils se redimensionnent
 * sans se déformer.
 */
export function pngSize(publicPath: string): { width: number; height: number } | null {
  try {
    const entete = readFileSync(join(process.cwd(), "public", publicPath)).subarray(0, 24);
    if (entete.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
    return { width: entete.readUInt32BE(16), height: entete.readUInt32BE(20) };
  } catch {
    return null;
  }
}

/**
 * Une image de largeur donnée, à hauteur proportionnelle.
 *
 * Renvoie un carré si les dimensions sont illisibles : mieux vaut une image
 * mal proportionnée qu'une carte qui n'existe pas.
 */
export function scaledToWidth(publicPath: string, width: number): { width: number; height: number } {
  const taille = pngSize(publicPath);
  return {
    width,
    height: taille ? Math.round((width * taille.height) / taille.width) : width,
  };
}

/**
 * Les deux ensembles finis et petits (11 crests + 5 postes ≈ 35 Ko) que toute
 * carte de classement utilise. Les champions (173 × ~4 Ko) et les emblèmes
 * (~150 Ko pièce) restent à la demande : les précharger coûterait 30 Mo pour
 * afficher trois paliers.
 */
export function preloadCommonAssets(): void {
  for (const tier of [...TIERS, "UNRANKED" as const]) asset(crestSrc(tier));
  for (const role of ROLES) asset(roleSrc(role));
}
