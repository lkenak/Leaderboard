import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { profileIconSrc } from "@/lib/lol";

/**
 * Cache disque des icônes de profil.
 *
 * Les icônes sont servies par Data Dragon, et c'est le seul asset des cartes
 * qu'on ne peut pas pré-embarquer : les identifiants se comptent en milliers
 * et dépendent du compte de chaque joueur (cf. `lib/lol.ts::profileIconSrc`).
 *
 * Elles ne peuvent pas non plus être chargées pendant le rendu : satori
 * irait les chercher lui-même, dans le chemin de rendu, sans délai de garde
 * et sans repli — une panne de Data Dragon ferait alors traîner ou échouer
 * chaque carte.
 *
 * D'où ce module en deux temps :
 *   1. `ensureProfileIcons()` télécharge ce qui manque, **avant** le rendu,
 *      avec un délai de garde et sans jamais lever ;
 *   2. `profileIconDataUri()` lit le cache, de façon synchrone, pendant le
 *      rendu — et renvoie `null` si l'icône manque, auquel cas la carte
 *      retombe sur la pastille d'initiale.
 *
 * Une icône absente n'est donc jamais une erreur, juste une carte un peu
 * moins jolie le temps d'un relevé.
 */

const DOSSIER = join(
  process.env.LADDER_DATA_DIR ?? join(process.cwd(), ".data"),
  "cache",
  "profile-icons",
);

/** Au-delà, on rend la carte sans l'icône plutôt que de faire attendre. */
const TIMEOUT_MS = 2_500;

/** Au-delà, ce n'est pas une icône de profil mais autre chose. */
const TAILLE_MAX = 2 * 1024 * 1024;

/**
 * Côté du PNG mis en cache.
 *
 * Data Dragon sert des icônes jusqu'à 1024 px et 120 Ko, pour un rendu en
 * 48 px. Les garder telles quelles ferait passer plus d'un mégaoctet de
 * data-URI à satori sur un classement de dix lignes, à décoder à chaque
 * rendu. 96 px couvre le 48 px de la carte en densité double.
 */
const COTE = 96;

/**
 * Réduit l'icône si `sharp` est disponible, sinon renvoie l'original.
 *
 * Import dynamique et échec toléré : `sharp` arrive comme dépendance
 * optionnelle de Next (c'est le rastériseur de `next/og`), il est donc là en
 * pratique — mais une dépendance qu'on ne déclare pas soi-même ne doit pas
 * pouvoir casser une carte.
 */
async function reduire(buf: Buffer): Promise<Buffer> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(buf).resize(COTE, COTE, { fit: "cover" }).png({ quality: 90 }).toBuffer();
  } catch {
    return buf;
  }
}

const memoire = new Map<number, string | null>();

function chemin(id: number): string {
  return join(DOSSIER, `${id}.png`);
}

/**
 * Télécharge les icônes manquantes. Ne lève jamais : l'absence d'une icône
 * ne doit pas empêcher une carte de sortir.
 */
export async function ensureProfileIcons(ids: Array<number | null>): Promise<void> {
  const manquants = [...new Set(ids.filter((id): id is number => typeof id === "number" && id > 0))]
    .filter((id) => !existsSync(chemin(id)));
  if (manquants.length === 0) return;

  mkdirSync(DOSSIER, { recursive: true });

  // En parallèle : ce sont quelques dizaines de kilo-octets chacune, et une
  // carte de douze lignes ne doit pas coûter douze allers-retours en série.
  await Promise.all(
    manquants.map(async (id) => {
      try {
        const res = await fetch(profileIconSrc(id), {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return;

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength === 0 || buf.byteLength > TAILLE_MAX) return;
        // Vérification de la signature PNG : une erreur de Data Dragon
        // renvoyée en 200 (page HTML) ne doit pas se retrouver en cache, où
        // elle empoisonnerait tous les rendus suivants.
        if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return;

        await writeFile(chemin(id), await reduire(buf));
        // Le fichier a changé : oublier une éventuelle absence mémorisée.
        memoire.delete(id);
      } catch {
        // Data Dragon injoignable, délai dépassé, disque plein : la carte
        // sortira avec la pastille d'initiale. Rien à signaler.
      }
    }),
  );
}

/**
 * L'icône en data-URI, ou `null` si elle n'est pas en cache.
 *
 * Synchrone et memoïsée : appelée pendant le rendu, une fois par ligne.
 */
export function profileIconDataUri(id: number | null): string | null {
  if (id === null || id <= 0) return null;

  const connu = memoire.get(id);
  if (connu !== undefined) return connu;

  let uri: string | null = null;
  try {
    uri = `data:image/png;base64,${readFileSync(chemin(id)).toString("base64")}`;
  } catch {
    uri = null;
  }
  memoire.set(id, uri);
  return uri;
}
