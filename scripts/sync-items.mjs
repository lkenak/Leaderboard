/**
 * Régénère lib/items.ts et les vignettes de public/lol/items depuis
 * Data Dragon. À relancer après un patch qui change la liste des objets.
 *
 *   npm run items:sync
 */
import fs from "node:fs";
import path from "node:path";

const OUT_TS = "lib/items.ts";
const OUT_IMG = "public/lol/items";

const versions = await (
  await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
).json();
const version = versions[0];
const data = await (
  await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/item.json`,
  )
).json();

const ids = Object.keys(data.data).sort((a, b) => Number(a) - Number(b));
fs.mkdirSync(OUT_IMG, { recursive: true });

let downloaded = 0;
for (const id of ids) {
  const file = path.join(OUT_IMG, `${id}.png`);
  if (fs.existsSync(file)) continue;
  const full = data.data[id].image.full;
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${full}`,
  );
  if (!res.ok) {
    console.warn(`  vignette absente pour ${id} (${res.status})`);
    continue;
  }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  downloaded++;
}

const nameEntries = ids
  .map((id) => `  ${id}: ${JSON.stringify(data.data[id].name)},`)
  .join("\n");

const lines = [
  "/**",
  ` * Table des objets, générée depuis Data Dragon ${version} (locale fr_FR).`,
  " *",
  " * Sert à afficher un nom lisible et une vignette (public/lol/items) pour",
  " * les items renvoyés par match-v5 (item0..item6). Un objet plus proposé au",
  " * patch courant mais présent dans une vieille partie garde son entrée tant",
  " * qu'une synchronisation ne l'a pas fait sortir d'item.json.",
  " *",
  " * Régénérer avec `npm run items:sync`. Ne pas éditer à la main.",
  " */",
  "",
  "export const ITEM_NAMES: Record<number, string> = {",
  nameEntries,
  "};",
  "",
  "export function itemSrc(id: number): string {",
  '  return `/lol/items/${id}.png`;',
  "}",
  "",
  "export function itemLabel(id: number): string {",
  '  return ITEM_NAMES[id] ?? "";',
  "}",
  "",
];

fs.writeFileSync(OUT_TS, lines.join("\n"));
console.log(
  `Data Dragon ${version} — ${ids.length} objets, ${downloaded} vignette(s) téléchargée(s), ${OUT_TS} écrit.`,
);
