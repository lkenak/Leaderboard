/**
 * Régénère lib/champions.ts et les vignettes de public/lol/champions depuis
 * Data Dragon. À relancer après un patch qui ajoute un champion.
 *
 *   npm run champions:sync
 */
import fs from "node:fs";
import path from "node:path";

const OUT_TS = "lib/champions.ts";
const OUT_IMG = "public/lol/champions";

const versions = await (
  await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
).json();
const version = versions[0];
const data = await (
  await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`,
  )
).json();

const ids = Object.keys(data.data).sort();
fs.mkdirSync(OUT_IMG, { recursive: true });

let downloaded = 0;
for (const id of ids) {
  const file = path.join(OUT_IMG, `${id}.png`);
  if (fs.existsSync(file)) continue;
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`,
  );
  if (!res.ok) {
    console.warn(`  vignette absente pour ${id} (${res.status})`);
    continue;
  }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  downloaded++;
}

const ident = (id) => (/^[A-Za-z][A-Za-z0-9]*$/.test(id) ? id : JSON.stringify(id));
const nameEntries = ids
  .map((id) => `  ${ident(id)}: ${JSON.stringify(data.data[id].name)},`)
  .join("\n");
const numericEntries = ids
  .map(
    (id) =>
      `  ${JSON.stringify(String(data.data[id].key))}: ${JSON.stringify(id)},`,
  )
  .join("\n");

// Le fichier généré est assemblé ligne par ligne : un gros littéral de gabarit
// contenant lui-même des accents graves et des ${} serait illisible et fragile.
const lines = [
  "/**",
  ` * Table des champions, générée depuis Data Dragon ${version} (locale fr_FR).`,
  " *",
  " * Elle sert à trois choses que l'API ne fait pas seule :",
  " *  - retrouver le fichier de public/lol/champions à partir du championName",
  " *    renvoyé par match-v5, dont la casse diffère parfois de la clé Data",
  " *    Dragon (le cas connu est FiddleSticks contre Fiddlesticks) ;",
  " *  - afficher un nom lisible : l'API renvoie MonkeyKing, le joueur lit",
  " *    « Wukong » ;",
  " *  - traduire l'identifiant numérique de champion, seul format renvoyé par",
  " *    spectator-v5 pour une partie en cours.",
  " *",
  " * Régénérer avec `npm run champions:sync`. Ne pas éditer à la main.",
  " */",
  "",
  "export const CHAMPION_NAMES: Record<string, string> = {",
  nameEntries,
  "};",
  "",
  "/** Identifiant numérique (spectator-v5) vers clé Data Dragon. */",
  "export const CHAMPION_BY_NUMERIC_ID: Record<string, string> = {",
  numericEntries,
  "};",
  "",
  "/** Normalisation commune : casse et ponctuation retirées. */",
  "function norm(value: string): string {",
  '  return value.toLowerCase().replace(/[^a-z0-9]/g, "");',
  "}",
  "",
  "const BY_NORM: Record<string, string> = Object.fromEntries(",
  "  Object.keys(CHAMPION_NAMES).map((id) => [norm(id), id]),",
  ");",
  "",
  "/**",
  " * Clé Data Dragon canonique pour un championName de l'API. Renvoie l'entrée",
  " * telle quelle si elle est inconnue : un champion sorti après la dernière",
  " * synchronisation doit dégrader une icône, pas casser la page.",
  " */",
  "export function championKey(championName: string): string {",
  "  return BY_NORM[norm(championName)] ?? championName;",
  "}",
  "",
  "export function championLabel(championName: string): string {",
  "  return CHAMPION_NAMES[championKey(championName)] ?? championName;",
  "}",
  "",
  "export function championKeyFromNumericId(id: number | string): string | null {",
  "  return CHAMPION_BY_NUMERIC_ID[String(id)] ?? null;",
  "}",
  "",
  `export const DDRAGON_VERSION = ${JSON.stringify(version)};`,
  "",
];

fs.writeFileSync(OUT_TS, lines.join("\n"));
console.log(
  `Data Dragon ${version} — ${ids.length} champions, ${downloaded} vignette(s) téléchargée(s), ${OUT_TS} écrit.`,
);
