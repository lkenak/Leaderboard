# Branchement sur l'API Riot

Ce dossier est volontairement vide de logique : le classement affiché vient de
`lib/mock.ts`, et la seule chose à écrire ici est un adaptateur qui produit le
même `RankingSnapshot`. Les composants n'ont alors pas une ligne à changer.

## Ce que le modèle attend déjà

`lib/types.ts` reprend les noms de champs de l'API Riot (`tier`, `division`,
`leaguePoints`, `wins`, `losses`, `puuid`, `gameName` / `tagLine`,
`championName`), donc la conversion est surtout du regroupement, pas du
renommage.

## Chaîne d'appels par joueur

| Étape | Endpoint | Ce qu'on en tire |
|---|---|---|
| 1 | `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` (routing régional : `europe`, `americas`, `asia`) | `puuid` |
| 2 | `GET /lol/summoner/v4/summoners/by-puuid/{puuid}` (platform : `euw1`…) | `profileIconId`, `summonerLevel` |
| 3 | `GET /lol/league/v4/entries/by-puuid/{puuid}` | l'entrée `RANKED_SOLO_5x5` → `tier`, `rank`, `leaguePoints`, `wins`, `losses` |
| 4 | `GET /lol/match/v5/matches/by-puuid/{puuid}/ids?queue=420&count=26` puis `GET /lol/match/v5/matches/{matchId}` | `recentGames`, `form`, `streak`, `kda`, `champions` |
| 5 | `GET /lol/spectator/v5/active-games/by-summoner/{puuid}` | `live` (404 = pas en partie, ce n'est pas une erreur) |

`absoluteLp` se calcule ensuite avec `absoluteLp()` de `lib/lol.ts`, et
`position` / `positionDelta` avec `reposition()` de `lib/ranking.ts`.

## Les deux points qui demandent une vraie décision

**1. Le delta de LP par partie n'existe pas dans l'API.** Match-v5 ne renvoie
aucun LP. Il faut relever `leaguePoints` à intervalle régulier et le stocker :
`lpDelta` est la différence entre deux relevés encadrant la partie. Sans
historique persisté, `session.lp`, `lpHistory`, `positionDelta` et la colonne
`±LP` ne sont pas calculables — c'est la seule raison pour laquelle une base de
données est nécessaire ici.

**2. Les quotas.** Une clé de développement est limitée à 20 requêtes / s et
100 / 2 min ; l'étape 4 coûte à elle seule 27 requêtes par joueur. Pour un
plateau de 32 joueurs, il faut donc :

- un travail de fond (cron) qui rafraîchit les rangs toutes les 2 à 5 minutes et
  n'appelle match-v5 que pour les joueurs dont `wins + losses` a changé ;
- un cache servi à la page, jamais d'appel Riot dans le rendu ;
- le `puuid` mis en cache définitivement (il ne change pas), contrairement au
  Riot ID qui, lui, peut être modifié par le joueur.

Le site de référence interroge son propre back-end et ne rafraîchit son
classement que toutes les 30 minutes (± 5 min de gigue) : c'est l'ordre de
grandeur à viser, et cela reste très en dessous des quotas.

## Signature à implémenter

```ts
// lib/riot/snapshot.ts
export async function fetchSnapshot(
  bracket: "high-elo" | "low-elo",
): Promise<RankingSnapshot>;
```

Il suffira alors de remplacer `buildAllSnapshots(now)` dans
`app/ranking/page.tsx`. Prévoir `RIOT_API_KEY` en variable d'environnement
serveur (jamais `NEXT_PUBLIC_`).
