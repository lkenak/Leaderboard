/**
 * Table des runes, générée depuis Data Dragon 16.18.1 (arbres et runes) et
 * Community Dragon (fragments de statistique) — locale fr_FR.
 *
 * Couvre trois échelles d'identifiants renvoyées par match-v5
 * (perks.styles[].style, perks.styles[].selections[].perk,
 * perks.statPerks.*) sous une seule table : un identifiant numérique, un
 * nom, une vignette dans public/lol/runes.
 *
 * Régénérer avec `npm run runes:sync`. Ne pas éditer à la main.
 */

export const RUNE_NAMES: Record<number, string> = {
  5001: "Health Scaling",
  5002: "Armor",
  5003: "Magic Resist",
  5005: "Attack Speed",
  5007: "Ability Haste",
  5008: "Adaptive Force",
  5010: "Move Speed",
  5011: "Health",
  5012: "Resist Scaling",
  5013: "Tenacity and Slow Resist",
  8000: "Précision",
  8005: "Attaque soutenue",
  8008: "Tempo mortel",
  8009: "Présence d'esprit",
  8010: "Conquérant",
  8014: "Coup de grâce",
  8017: "Abattage",
  8021: "Jeu de jambes",
  8100: "Domination",
  8105: "Chasseur acharné",
  8106: "Chasseur ultime",
  8112: "Électrocution",
  8126: "Coup bas",
  8128: "Moisson noire",
  8135: "Chasseur de trésors",
  8137: "Sixième sens",
  8139: "Goût du sang",
  8140: "Souvenirs épouvantables",
  8141: "Balise de profondeur",
  8143: "Ruée offensive",
  8200: "Sorcellerie",
  8210: "Transcendance",
  8214: "Invocation d'Aery",
  8224: "Arcaniste axiomatique",
  8226: "Ruban de mana",
  8229: "Comète arcanique",
  8230: "Assaut du maraudeur",
  8232: "Marche sur l'eau",
  8233: "Concentration absolue",
  8234: "Célérité",
  8236: "Tempête menaçante",
  8237: "Brûlure",
  8242: "Inébranlable",
  8275: "Manteau nuageux",
  8299: "Baroud d'honneur",
  8300: "Inspiration",
  8304: "Chaussures magiques",
  8306: "Canaliportation Hextech",
  8313: "Triple tonique",
  8316: "Polyvalence",
  8321: "Remise immédiate",
  8345: "Livraison de biscuits",
  8347: "Savoir cosmique",
  8351: "Optimisation glaciale",
  8352: "Philtre de chronodistorsion",
  8360: "Grimoire déchaîné",
  8369: "Premier coup",
  8400: "Volonté",
  8401: "Coup de bouclier",
  8410: "Vitesse d'approche",
  8429: "Conditionnement",
  8437: "Poigne de l'immortel",
  8439: "Après-coup",
  8444: "Second souffle",
  8446: "Démolition",
  8451: "Surcroissance",
  8453: "Revitalisation",
  8463: "Fontaine de vie",
  8465: "Gardien",
  8473: "Plaque d'os",
  8992: "Toucher de feu mortel",
  9101: "Absorption vitale",
  9103: "Légende : sangsue",
  9104: "Légende : alacrité",
  9105: "Légende : accélération",
  9111: "Triomphe",
  9923: "Déluge de lames",
};

export function runeSrc(id: number): string {
  return `/lol/runes/${id}.png`;
}

export function runeLabel(id: number): string {
  return RUNE_NAMES[id] ?? "";
}
