import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Résolution de la clé Riot.
 *
 * Deux sources, dans cet ordre :
 *
 *  1. **une clé saisie depuis `/admin`**, rangée sur le disque ;
 *  2. **`RIOT_API_KEY`** dans l'environnement.
 *
 * La saisie à l'écran existe parce qu'une clé de *développement* meurt toutes
 * les 24 h : la remplacer voudrait dire éditer `.env.local` puis relancer le
 * serveur chaque matin, alors qu'une clé se colle en deux secondes dans un
 * champ. Le jour où la clé *personnelle* est accordée, on la met dans
 * `RIOT_API_KEY`, on oublie la clé saisie, et cette mécanique s'efface.
 *
 * La clé vit dans son propre fichier, pas dans `store.json`, pour une raison
 * précise : le relevé se copie, se sauvegarde, se colle dans un rapport de
 * bug. Un secret qui voyagerait avec lui finirait par fuir. Ici il est seul,
 * en 0600, dans un répertoire déjà ignoré par git.
 *
 * Elle n'est en revanche pas chiffrée, et c'est délibéré : la déchiffrer
 * supposerait un secret lisible par le même processus, sur le même disque,
 * donc par quiconque peut déjà lire ce fichier — celui-là même qui peut lire
 * `.env.local`. Le chiffrement n'ajouterait que l'illusion d'une protection.
 */

const DATA_DIR = process.env.LADDER_DATA_DIR ?? join(process.cwd(), ".data");
const KEY_PATH = join(DATA_DIR, "riot-key.json");

/** Durée de vie d'une clé de développement, à partir de sa génération. */
export const DEV_KEY_LIFETIME_MS = 24 * 60 * 60_000;

export type KeySource = "admin" | "env" | "none";

/** Ce que l'interface a le droit de savoir. Jamais la clé elle-même : une
 *  action serveur sérialise sa valeur de retour vers le navigateur. */
export interface KeyStatus {
  source: KeySource;
  /** `RGAPI-xxxx…9f2c`, jamais la clé entière. */
  masked: string | null;
  /** Horodatage de la saisie — `null` pour une clé venue de l'environnement. */
  setAt: number | null;
  /** Horodatage du refus, si Riot a répondu 401/403 sur la clé en place. */
  rejectedAt: number | null;
}

export class InvalidKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidKeyError";
  }
}

interface KeyFile {
  /** Clé saisie depuis `/admin`. Absente : on s'appuie sur l'environnement. */
  entered?: { value: string; setAt: number };
  /**
   * Dernier refus de Riot, repéré par empreinte et non par valeur, afin de
   * couvrir aussi une clé venue de l'environnement — sans recopier le secret
   * une seconde fois dans le fichier.
   */
  rejected?: { fingerprint: string; at: number };
}

/* ── Cache de processus ───────────────────────────────────────────────────── */

/**
 * `undefined` : fichier pas encore lu. `null` : lu, rien dedans.
 *
 * Sans ce cache, chaque appel Riot d'une synchronisation — plusieurs centaines
 * — rouvrirait le fichier. Le cache est autoritaire pour le processus : toute
 * écriture passe par ce module et le met à jour.
 */
let cache: KeyFile | null | undefined;

async function load(): Promise<KeyFile | null> {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(await readFile(KEY_PATH, "utf8")) as KeyFile;
  } catch {
    // Fichier absent, illisible ou JSON abîmé : on retombe sur
    // l'environnement plutôt que de casser la page.
    cache = null;
  }
  return cache;
}

async function save(next: KeyFile): Promise<void> {
  await mkdir(dirname(KEY_PATH), { recursive: true });
  const tmp = `${KEY_PATH}.${process.pid}.tmp`;
  // 0600 posé à la création, pas après : entre les deux, le fichier serait
  // lisible par tout le monde. `rename` conserve le mode.
  await writeFile(tmp, JSON.stringify(next, null, 1), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(tmp, KEY_PATH);
  cache = next;
}

/* ── Normalisation ───────────────────────────────────────────────────────── */

/**
 * Accepte ce que l'on colle réellement : la clé seule, entourée d'espaces ou
 * de guillemets, ou la ligne entière copiée depuis `.env.local`.
 */
export function normaliseKey(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^RIOT_API_KEY\s*=\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  if (cleaned === "") {
    throw new InvalidKeyError("Aucune clé saisie.");
  }
  if (/\s/.test(cleaned)) {
    throw new InvalidKeyError(
      "La clé contient un espace : la copie a sans doute emporté du texte autour.",
    );
  }
  if (!cleaned.startsWith("RGAPI-") || cleaned.length < 26) {
    throw new InvalidKeyError(
      "Une clé Riot commence par « RGAPI- » et fait une quarantaine de caractères.",
    );
  }
  return cleaned;
}

function fingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function maskKey(key: string): string {
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

/* ── Lecture ─────────────────────────────────────────────────────────────── */

/** La clé à employer, saisie ou d'environnement. `null` : aucune des deux. */
export async function riotKey(): Promise<string | null> {
  const file = await load();
  return file?.entered?.value ?? process.env.RIOT_API_KEY ?? null;
}

export async function hasKey(): Promise<boolean> {
  return (await riotKey()) !== null;
}

/**
 * `true` quand Riot a refusé la clé en place. Sert à ne pas marteler l'API
 * avec une clé morte — le relevé automatique s'arrête, le bandeau prend le
 * relais, et coller une nouvelle clé remet tout en route.
 */
export async function keyRejected(): Promise<boolean> {
  return (await keyStatus()).rejectedAt !== null;
}

export async function keyStatus(): Promise<KeyStatus> {
  const file = await load();
  const entered = file?.entered;
  const key = entered?.value ?? process.env.RIOT_API_KEY ?? null;

  if (key === null) {
    return { source: "none", masked: null, setAt: null, rejectedAt: null };
  }
  // L'empreinte évite le faux positif qui compte le plus : une clé neuve
  // héritant du refus de celle qu'elle remplace.
  const refused =
    file?.rejected && file.rejected.fingerprint === fingerprint(key)
      ? file.rejected.at
      : null;

  return {
    source: entered ? "admin" : "env",
    masked: maskKey(key),
    setAt: entered?.setAt ?? null,
    rejectedAt: refused,
  };
}

/* ── Écriture ────────────────────────────────────────────────────────────── */

/** @returns la clé normalisée, telle qu'elle a été rangée. */
export async function saveKey(raw: string): Promise<string> {
  const key = normaliseKey(raw);
  const file = (await load()) ?? {};
  const next: KeyFile = { entered: { value: key, setAt: Date.now() } };
  // Le refus d'une *autre* clé reste vrai et doit survivre ; celui de
  // celle-ci disparaît, puisqu'on vient de la valider.
  if (file.rejected && file.rejected.fingerprint !== fingerprint(key)) {
    next.rejected = file.rejected;
  }
  await save(next);
  return key;
}

/** Oublie la clé saisie et repasse à `RIOT_API_KEY`, si elle existe. */
export async function forgetKey(): Promise<void> {
  const file = await load();
  if (!file?.entered) return;
  if (file.rejected) {
    await save({ rejected: file.rejected });
    return;
  }
  // Plus rien à retenir : on retire le fichier au lieu de laisser une coquille.
  try {
    await unlink(KEY_PATH);
  } catch {
    // Déjà absent : le résultat voulu est atteint.
  }
  cache = null;
}

/**
 * Note qu'une clé a été refusée par Riot.
 *
 * `used` est la clé qui a essuyé le 401/403, pas forcément celle en place :
 * une synchronisation en cours peut se terminer après qu'une clé neuve a été
 * collée, et marquer cette dernière pour la faute de la précédente serait le
 * plus sûr moyen de rendre le bandeau incompréhensible.
 */
export async function markKeyRejected(used: string): Promise<void> {
  const file = (await load()) ?? {};
  const print = fingerprint(used);
  if (file.rejected?.fingerprint === print) return;
  await save({ ...file, rejected: { fingerprint: print, at: Date.now() } });
}

/** Remet le compteur à zéro : utile quand un 401 s'avère passager. */
export async function clearRejection(): Promise<void> {
  const file = await load();
  if (!file?.rejected) return;
  const next = { ...file };
  delete next.rejected;
  await save(next);
}
