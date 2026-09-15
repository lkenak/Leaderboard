/**
 * Vérifie que la clé Riot fonctionne, avant de se demander pourquoi le
 * classement reste vide.
 *
 *   npm run riot:check                 -> teste la clé seule
 *   npm run riot:check -- "Pseudo#TAG" -> teste la résolution d'un compte
 *   npm run riot:check -- "Pseudo#TAG" EUNE
 */
const KEY = process.env.RIOT_API_KEY;
const [riotId, regionArg] = process.argv.slice(2);
const REGION = (regionArg ?? "EUW").toUpperCase();

const PLATFORM = { EUW: "euw1", EUNE: "eun1", NA: "na1", KR: "kr", BR: "br1", LAN: "la1", TR: "tr1" };
const CLUSTER = { EUW: "europe", EUNE: "europe", TR: "europe", NA: "americas", BR: "americas", LAN: "americas", KR: "asia" };

if (!KEY) {
  console.error("✗ RIOT_API_KEY absente.");
  console.error("  Copier .env.example vers .env.local et y coller une clé personnelle");
  console.error("  (https://developer.riotgames.com → Register Product → Personal).");
  console.error("  Ce script ne lit que l'environnement : une clé collée depuis /admin");
  console.error("  est vérifiée à la saisie, il n'y a rien à lancer ici.");
  process.exit(1);
}
if (!PLATFORM[REGION]) {
  console.error(`✗ Région inconnue : ${REGION}. Attendu : ${Object.keys(PLATFORM).join(", ")}`);
  process.exit(1);
}
console.log(`Clé : ${KEY.slice(0, 10)}…${KEY.slice(-4)} (${KEY.length} caractères)`);
if (KEY.startsWith("RGAPI-")) {
  console.log("  Format RGAPI- : clé de développement ou personnelle.");
  console.log("  Rappel : une clé de DÉVELOPPEMENT expire toutes les 24 h, une");
  console.log("  clé PERSONNELLE n'expire pas. Pour un site durable, prendre la seconde.");
}

async function call(url, label) {
  const res = await fetch(url, { headers: { "X-Riot-Token": KEY } });
  const limit = res.headers.get("x-app-rate-limit");
  const count = res.headers.get("x-app-rate-limit-count");
  if (!res.ok) {
    console.error(`✗ ${label} → HTTP ${res.status}`);
    if (res.status === 401 || res.status === 403) {
      console.error("  Clé refusée : invalide, expirée, ou ne couvrant pas cet endpoint.");
    }
    if (res.status === 429) console.error("  Quota dépassé, réessayer dans deux minutes.");
    return null;
  }
  console.log(`✓ ${label}${limit ? `  [quota ${count ?? "?"} / ${limit}]` : ""}`);
  return res.json();
}

// Un appel sans paramètre suffit à valider la clé : la liste Challenger existe
// toujours et ne dépend d'aucun compte.
const challenger = await call(
  `https://${PLATFORM[REGION]}.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`,
  `Clé acceptée sur ${REGION} (league-v4)`,
);
if (!challenger) process.exit(1);
const cut = challenger.entries?.reduce((m, e) => Math.min(m, e.leaguePoints), Infinity);
if (Number.isFinite(cut)) {
  console.log(`  Coupe Challenger ${REGION} : ${cut} LP (${challenger.entries.length} joueurs)`);
}

if (!riotId) {
  console.log("\nTout est en ordre. Pour tester un compte :");
  console.log('  npm run riot:check -- "Pseudo#TAG"');
  process.exit(0);
}

const hash = riotId.lastIndexOf("#");
if (hash <= 0) {
  console.error(`✗ Riot ID attendu sous la forme « Pseudo#TAG », reçu : ${riotId}`);
  process.exit(1);
}
const gameName = riotId.slice(0, hash);
const tagLine = riotId.slice(hash + 1);

const account = await call(
  `https://${CLUSTER[REGION]}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  `Riot ID résolu : ${gameName}#${tagLine}`,
);
if (!account) {
  console.error("  Vérifier l'orthographe, le tag et la région.");
  process.exit(1);
}
console.log(`  puuid : ${account.puuid.slice(0, 16)}…`);

const entries = await call(
  `https://${PLATFORM[REGION]}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
  "Rangs récupérés (league-v4/by-puuid)",
);
const solo = entries?.find((e) => e.queueType === "RANKED_SOLO_5x5");
if (solo) {
  console.log(`  SoloQ : ${solo.tier} ${solo.rank} ${solo.leaguePoints} LP — ${solo.wins}V ${solo.losses}D`);
} else {
  console.log("  Aucune partie classée en SoloQ : le compte serait exclu du classement.");
}

const ids = await call(
  `https://${CLUSTER[REGION]}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?queue=420&start=0&count=3`,
  "Historique accessible (match-v5)",
);
if (ids) console.log(`  ${ids.length} identifiant(s) de partie classée récupéré(s)`);

console.log("\nTout est en ordre : ce compte peut être ajouté depuis /admin.");
