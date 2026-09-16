import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Chargement des polices pour satori.
 *
 * satori refuse le WOFF2 (`Unsupported OpenType signature wOF2`) : la
 * transformation n'est pas une simple compression, la table `glyf` est
 * réécrite. D'où les `.ttf` de `public/fonts/`, obtenus en décompressant les
 * `.woff2` déjà versionnés — mêmes métriques que le site par construction.
 * Voir `public/fonts/README.md`.
 *
 * Lecture depuis `public/` et non depuis un dossier à part : `deploy.sh`
 * rsynce déjà `public/` vers `$CURRENT`, qui est le `cwd` du service web.
 * Aucune ligne de déploiement à ajouter.
 */

export interface CardFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
}

const FICHIERS: Array<{ name: string; file: string; weight: 400 | 500 | 600 | 700 }> = [
  { name: "General Sans", file: "general-sans/GeneralSans-500.ttf", weight: 500 },
  { name: "General Sans", file: "general-sans/GeneralSans-600.ttf", weight: 600 },
  { name: "General Sans", file: "general-sans/GeneralSans-700.ttf", weight: 700 },
  { name: "IBM Plex Mono", file: "ibm-plex-mono/IBMPlexMono-400.ttf", weight: 400 },
  { name: "IBM Plex Mono", file: "ibm-plex-mono/IBMPlexMono-500.ttf", weight: 500 },
  { name: "IBM Plex Mono", file: "ibm-plex-mono/IBMPlexMono-600.ttf", weight: 600 },
];

let cache: Promise<CardFont[]> | null = null;

/** Lues une fois, gardées en mémoire : ~300 Ko pour six fichiers. */
export function loadFonts(): Promise<CardFont[]> {
  cache ??= Promise.all(
    FICHIERS.map(async ({ name, file, weight }) => {
      const buf = await readFile(join(process.cwd(), "public", "fonts", file));
      return {
        name,
        data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        weight,
        style: "normal" as const,
      };
    }),
  );
  return cache;
}
