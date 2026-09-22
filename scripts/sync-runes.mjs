/**
 * Régénère lib/runes.ts et les vignettes de public/lol/runes depuis
 * Data Dragon (arbres et runes) et Community Dragon (fragments de statistique,
 * absents de runesReforged.json). À relancer après un patch qui change les
 * runes.
 *
 *   npm run runes:sync
 */
import fs from "node:fs";
import path from "node:path";

const OUT_TS = "lib/runes.ts";
const OUT_IMG = "public/lol/runes";

const versions = await (
  await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
).json();
const version = versions[0];
const trees = await (
  await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/runesReforged.json`,
  )
).json();

fs.mkdirSync(OUT_IMG, { recursive: true });

/** { id, name, iconUrl }[] — arbres, runes, puis fragments de statistique. */
const entries = [];
for (const tree of trees) {
  entries.push({
    id: tree.id,
    name: tree.name,
    iconUrl: `https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}`,
  });
  for (const slot of tree.slots) {
    for (const rune of slot.runes) {
      entries.push({
        id: rune.id,
        name: rune.name,
        iconUrl: `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`,
      });
    }
  }
}

// Les fragments de statistique (arbre du bas, une ligne par catégorie) ne sont
// pas dans runesReforged.json : ils viennent de Community Dragon, dont les
// chemins d'image sont systématiquement en minuscules.
const perks = await (
  await fetch(
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json",
  )
).json();
for (const perk of perks) {
  if (!/StatMods/i.test(perk.iconPath ?? "")) continue;
  // `iconPath` vaut "/lol-game-data/assets/v1/perk-images/..." : ce préfixe
  // désigne le plugin lui-même, déjà présent dans la base "global/default" —
  // le répéter donne une URL qui 404 (testé).
  const relative = perk.iconPath.replace(/^\/lol-game-data\/assets/i, "");
  entries.push({
    id: perk.id,
    name: perk.name,
    iconUrl: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default${relative.toLowerCase()}`,
  });
}

entries.sort((a, b) => a.id - b.id);

let downloaded = 0;
for (const entry of entries) {
  const file = path.join(OUT_IMG, `${entry.id}.png`);
  if (fs.existsSync(file)) continue;
  const res = await fetch(entry.iconUrl);
  if (!res.ok) {
    console.warn(`  vignette absente pour ${entry.id} (${res.status})`);
    continue;
  }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  downloaded++;
}

const nameEntries = entries
  .map((e) => `  ${e.id}: ${JSON.stringify(e.name)},`)
  .join("\n");

const lines = [
  "/**",
  ` * Table des runes, générée depuis Data Dragon ${version} (arbres et runes) et`,
  " * Community Dragon (fragments de statistique) — locale fr_FR.",
  " *",
  " * Couvre trois échelles d'identifiants renvoyées par match-v5",
  " * (perks.styles[].style, perks.styles[].selections[].perk,",
  " * perks.statPerks.*) sous une seule table : un identifiant numérique, un",
  " * nom, une vignette dans public/lol/runes.",
  " *",
  " * Régénérer avec `npm run runes:sync`. Ne pas éditer à la main.",
  " */",
  "",
  "export const RUNE_NAMES: Record<number, string> = {",
  nameEntries,
  "};",
  "",
  "export function runeSrc(id: number): string {",
  '  return `/lol/runes/${id}.png`;',
  "}",
  "",
  "export function runeLabel(id: number): string {",
  '  return RUNE_NAMES[id] ?? "";',
  "}",
  "",
];

fs.writeFileSync(OUT_TS, lines.join("\n"));
console.log(
  `Data Dragon ${version} — ${entries.length} entrées (arbres + runes + fragments), ` +
    `${downloaded} vignette(s) téléchargée(s), ${OUT_TS} écrit.`,
);
