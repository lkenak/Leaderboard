/**
 * Table des sorts d'invocateur, générée depuis Data Dragon 16.18.1
 * (locale fr_FR).
 *
 * match-v5 (summoner1Id/summoner2Id) renvoie l'identifiant numérique de
 * `key` ci-dessous, pas la clé texte de Data Dragon.
 *
 * Régénérer avec `npm run spells:sync`. Ne pas éditer à la main.
 */

export const SUMMONER_SPELL_NAMES: Record<number, string> = {
  1: "Purge",
  3: "Fatigue",
  4: "Saut éclair",
  6: "Fantôme",
  7: "Soins",
  11: "Châtiment",
  12: "Téléportation",
  13: "Clarté",
  14: "Embrasement",
  21: "Barrière",
  30: "Au roi !",
  31: "Jet de Poro",
  32: "Boule de neige",
  39: "Boule de neige",
  54: "Choisi en début de partie",
  55: "Bouche-trou et Attaque-Châtiment",
  71: "Purge",
  73: "Fatigue",
  74: "Saut éclair",
  75: "Clairvoyance",
  76: "Fantôme",
  77: "Soins",
  705: "Fortification",
  709: "Ralliement",
  711: "Châtiment",
  712: "Téléportation",
  713: "Clarté",
  714: "Embrasement",
  716: "Concentration",
  720: "Promotion",
  721: "Barrière",
  777: "Réanimation",
  2201: "Fuite",
  2202: "Saut éclair",
};

export function summonerSpellSrc(id: number): string {
  return `/lol/spells/${id}.png`;
}

export function summonerSpellLabel(id: number): string {
  return SUMMONER_SPELL_NAMES[id] ?? "";
}
