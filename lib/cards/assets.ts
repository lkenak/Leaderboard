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
 * Les dimensions intrinsèques d'une image, PNG ou SVG.
 *
 * Existe parce que supposer une image carrée coûte cher, et que ça s'est
 * produit deux fois : les emblèmes de palier sont en 16:9 et se sont retrouvés
 * étirés de 44 % dans un carré ; les crests, eux, ne sont carrés que pour
 * Émeraude, Platine et Diamant — Master est en 17×15, Fer en 17×12. Le bug ne
 * se voyait donc que sur certains paliers, ce qui est la pire façon de le
 * découvrir.
 *
 * PNG : largeur et hauteur vivent dans le bloc IHDR, aux octets 16 à 24.
 * SVG : le `viewBox` fait autorité, avec repli sur `width`/`height`.
 */
export function imageSize(publicPath: string): { width: number; height: number } | null {
  try {
    const octets = readFileSync(join(process.cwd(), "public", publicPath));

    if (octets.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
      return { width: octets.readUInt32BE(16), height: octets.readUInt32BE(20) };
    }

    // Les en-têtes SVG de ce projet tiennent dans les premiers octets ; lire
    // tout le fichier pour y chercher un attribut serait du gaspillage.
    const entete = octets.subarray(0, 512).toString("utf8");

    const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(entete);
    if (viewBox) {
      const n = viewBox[1].trim().split(/[\s,]+/).map(Number);
      if (n.length === 4 && n[2] > 0 && n[3] > 0) return { width: n[2], height: n[3] };
    }

    const w = /\bwidth\s*=\s*"([\d.]+)"/.exec(entete);
    const h = /\bheight\s*=\s*"([\d.]+)"/.exec(entete);
    if (w && h) return { width: Number(w[1]), height: Number(h[1]) };

    return null;
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
  const taille = imageSize(publicPath);
  return {
    width,
    height: taille ? Math.round((width * taille.height) / taille.width) : width,
  };
}

/**
 * Les dimensions pour tenir dans un carré sans se déformer — l'équivalent du
 * `object-contain` que le site applique à ses crests.
 *
 * Le carré, lui, garde sa taille : c'est ce qui aligne les blasons d'une ligne
 * à l'autre alors qu'ils n'ont pas tous le même rapport.
 */
export function fitInBox(publicPath: string, box: number): { width: number; height: number } {
  const taille = imageSize(publicPath);
  if (!taille) return { width: box, height: box };

  const facteur = Math.min(box / taille.width, box / taille.height);
  return {
    width: Math.round(taille.width * facteur),
    height: Math.round(taille.height * facteur),
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
