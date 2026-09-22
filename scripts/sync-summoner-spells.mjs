/**
 * Régénère lib/summoner-spells.ts et les vignettes de public/lol/spells
 * depuis Data Dragon. À relancer si Riot change la liste des sorts.
 *
 *   npm run spells:sync
 */
import fs from "node:fs";
import path from "node:path";

const OUT_TS = "lib/summoner-spells.ts";
const OUT_IMG = "public/lol/spells";

const versions = await (
  await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
).json();
const version = versions[0];
const data = await (
  await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/summoner.json`,
  )
).json();

const keys = Object.keys(data.data).sort();
fs.mkdirSync(OUT_IMG, { recursive: true });

let downloaded = 0;
const entries = [];
for (const key of keys) {
  const spell = data.data[key];
  const id = Number(spell.key);
  entries.push({ id, name: spell.name });

  const file = path.join(OUT_IMG, `${id}.png`);
  if (fs.existsSync(file)) continue;
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spell.image.full}`,
  );
  if (!res.ok) {
    console.warn(`  vignette absente pour ${key} (${res.status})`);
    continue;
  }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  downloaded++;
}

entries.sort((a, b) => a.id - b.id);
const nameEntries = entries
  .map((e) => `  ${e.id}: ${JSON.stringify(e.name)},`)
  .join("\n");

const lines = [
  "/**",
  ` * Table des sorts d'invocateur, générée depuis Data Dragon ${version}`,
  " * (locale fr_FR).",
  " *",
  " * match-v5 (summoner1Id/summoner2Id) renvoie l'identifiant numérique de",
  " * `key` ci-dessous, pas la clé texte de Data Dragon.",
  " *",
  " * Régénérer avec `npm run spells:sync`. Ne pas éditer à la main.",
  " */",
  "",
  "export const SUMMONER_SPELL_NAMES: Record<number, string> = {",
  nameEntries,
  "};",
  "",
  "export function summonerSpellSrc(id: number): string {",
  '  return `/lol/spells/${id}.png`;',
  "}",
  "",
  "export function summonerSpellLabel(id: number): string {",
  '  return SUMMONER_SPELL_NAMES[id] ?? "";',
  "}",
  "",
];

fs.writeFileSync(OUT_TS, lines.join("\n"));
console.log(
  `Data Dragon ${version} — ${entries.length} sorts, ${downloaded} vignette(s) téléchargée(s), ${OUT_TS} écrit.`,
);
