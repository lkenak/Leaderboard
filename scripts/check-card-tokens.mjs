/**
 * Vérifie que `lib/cards/tokens.ts` dit la même chose que le `@theme` de
 * `app/globals.css`.
 *
 * Pourquoi ce script existe : les cartes envoyées sur Discord sont dessinées
 * par satori, qui ne connaît ni Tailwind, ni `var()`, ni la cascade. Elles ne
 * peuvent donc pas lire les jetons du site — il faut les recopier. Sans
 * garde-fou, la première retouche de la charte ferait diverger l'image du
 * site en silence, et personne ne s'en apercevrait avant une capture d'écran.
 *
 * Branché en `prebuild`, donc il tourne dans `npm run build`, donc dans
 * `deploy/deploy.sh` : un déploiement qui ferait dériver la charte échoue
 * avant de redémarrer quoi que ce soit.
 *
 * Correspondance des noms :
 *   --color-panel-2   → COLOR.panel2
 *   --color-acid-ink  → COLOR.acidInk
 *   --color-t-emerald → TIER_COLOR.EMERALD
 *   --radius-md       → RADIUS.md
 *   --text-num        → TEXT.num        (en px : les rem × 16)
 *   --font-sans       → FONT.sans       (la première famille, sans les replis)
 *
 * Zéro dépendance : deux lectures de fichier et des expressions régulières.
 * Importer le module TypeScript demanderait un transpileur dans le chemin du
 * build, pour comparer une quinzaine de chaînes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const CSS = join(RACINE, "app", "globals.css");
const TS = join(RACINE, "lib", "cards", "tokens.ts");

/* ── Lecture du @theme ────────────────────────────────────────────────────── */

function lireTheme(source) {
  const debut = source.indexOf("@theme {");
  if (debut === -1) throw new Error("Bloc @theme introuvable dans app/globals.css");

  // Parcours à accolades équilibrées : le bloc contient des `{}` (aucun
  // aujourd'hui, mais un `@media` imbriqué demain casserait un indexOf("}")).
  let profondeur = 0;
  let fin = -1;
  for (let i = source.indexOf("{", debut); i < source.length; i++) {
    if (source[i] === "{") profondeur++;
    else if (source[i] === "}" && --profondeur === 0) {
      fin = i;
      break;
    }
  }
  if (fin === -1) throw new Error("Bloc @theme non refermé dans app/globals.css");

  const corps = source.slice(debut, fin);
  const jetons = new Map();
  for (const [, nom, valeur] of corps.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    jetons.set(nom, valeur.trim());
  }
  return jetons;
}

/* ── Lecture de tokens.ts ─────────────────────────────────────────────────── */

/** Extrait les paires `clé: "valeur"` d'un objet nommé, sans exécuter le TS. */
function lireObjet(source, nom) {
  const ancre = new RegExp(`(?:const|let)\\s+${nom}\\b[^=]*=\\s*\\{`).exec(source);
  if (!ancre) throw new Error(`Objet ${nom} introuvable dans lib/cards/tokens.ts`);

  let profondeur = 0;
  let fin = -1;
  const debut = ancre.index + ancre[0].length - 1;
  for (let i = debut; i < source.length; i++) {
    if (source[i] === "{") profondeur++;
    else if (source[i] === "}" && --profondeur === 0) {
      fin = i;
      break;
    }
  }
  if (fin === -1) throw new Error(`Objet ${nom} non refermé dans lib/cards/tokens.ts`);

  // `fin + 1` : l'accolade fermante fait partie de la tranche, sinon la
  // dernière paire d'un objet écrit sur une ligne (`{ … lg: 8 }`) n'a plus de
  // terminateur et échappe au motif.
  const corps = source.slice(debut, fin + 1);
  const paires = new Map();
  // Pas d'ancre de ligne : `RADIUS` tient sur une seule ligne, et la dernière
  // paire d'un objet n'a pas forcément de virgule finale.
  for (const [, cle, chaine, nombre] of corps.matchAll(
    /([A-Za-z0-9_]+)\s*:\s*(?:"([^"]*)"|([0-9.]+))\s*(?=[,}])/g,
  )) {
    paires.set(cle, chaine !== undefined ? chaine : nombre);
  }
  return paires;
}

/* ── Correspondance des noms ──────────────────────────────────────────────── */

function camel(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** `1.125rem` → `18`, `56` → `56`. */
function remEnPx(valeur) {
  const m = /^([0-9.]+)rem$/.exec(valeur);
  return m ? String(Math.round(parseFloat(m[1]) * 16)) : valeur;
}

/** `"General Sans", ui-sans-serif, …` → `General Sans`. */
function premiereFamille(valeur) {
  return valeur.split(",")[0].trim().replace(/^["']|["']$/g, "");
}

/** Les couleurs se comparent à la casse près : `#E9FF1F` vaut `#e9ff1f`. */
function normaliser(valeur) {
  return valeur.toLowerCase().replace(/\s+/g, " ").trim();
}

/* ── Vérification ─────────────────────────────────────────────────────────── */

const theme = lireTheme(readFileSync(CSS, "utf8"));
const ts = readFileSync(TS, "utf8");

const COLOR = lireObjet(ts, "COLOR");
const TIER_COLOR = lireObjet(ts, "TIER_COLOR");
const TEXT = lireObjet(ts, "TEXT");
const RADIUS = lireObjet(ts, "RADIUS");
const FONT = lireObjet(ts, "FONT");

const ecarts = [];

function comparer(jeton, attendu, ou, cle, transforme = (v) => v) {
  const obtenu = ou.get(cle);
  if (obtenu === undefined) {
    ecarts.push(`${jeton} : absent de tokens.ts (attendu sous la clé « ${cle} »)`);
    return;
  }
  const a = normaliser(transforme(attendu));
  const b = normaliser(obtenu);
  if (a !== b) ecarts.push(`${jeton} : globals.css dit « ${a} », tokens.ts dit « ${b} »`);
}

for (const [nom, valeur] of theme) {
  if (nom.startsWith("color-t-")) {
    comparer(`--${nom}`, valeur, TIER_COLOR, nom.slice("color-t-".length).toUpperCase());
  } else if (nom.startsWith("color-")) {
    comparer(`--${nom}`, valeur, COLOR, camel(nom.slice("color-".length)));
  } else if (nom.startsWith("radius-")) {
    comparer(`--${nom}`, valeur, RADIUS, nom.slice("radius-".length), (v) => v.replace("px", ""));
  } else if (nom.startsWith("text-") && !nom.includes("--")) {
    comparer(`--${nom}`, valeur, TEXT, nom.slice("text-".length), remEnPx);
  } else if (nom === "font-sans" || nom === "font-mono") {
    comparer(`--${nom}`, valeur, FONT, nom.slice("font-".length), premiereFamille);
  }
}

// L'inverse : une couleur inventée dans tokens.ts et absente de la charte.
// `UNRANKED` est la seule exception admise — le CSS n'a pas besoin de la
// nommer, il n'affiche aucune couleur pour un joueur non classé.
for (const cle of TIER_COLOR.keys()) {
  if (cle === "UNRANKED") continue;
  if (!theme.has(`color-t-${cle.toLowerCase()}`)) {
    ecarts.push(`TIER_COLOR.${cle} : aucun --color-t-${cle.toLowerCase()} dans globals.css`);
  }
}

if (ecarts.length > 0) {
  console.error("\n  Les jetons des cartes ont dérivé de la charte du site :\n");
  for (const e of ecarts) console.error(`    • ${e}`);
  console.error(
    "\n  Corriger lib/cards/tokens.ts (ou app/globals.css) pour que les deux" +
      "\n  disent la même chose — sinon les cartes Discord ne ressembleront" +
      "\n  plus au site, sans que rien ne le signale.\n",
  );
  process.exit(1);
}

console.log(`[cartes] ${theme.size} jetons lus, tokens.ts conforme à la charte.`);
