# Branchement sur l'API Riot

Ce dossier contient l'intégration complète. Il n'y a rien à écrire pour
démarrer : il faut une clé et des comptes.

## Mise en route

1. **Prendre une clé personnelle** sur
   [developer.riotgames.com](https://developer.riotgames.com) →
   *Register Product* → **Personal**.
   La clé de développement obtenue en deux clics sur la page d'accueil
   **expire toutes les 24 h** ; la clé personnelle, non. Elle s'enregistre sans
   processus de vérification et convient exactement à un site privé entre amis.
2. `cp .env.example .env.local`, puis y coller la clé.
3. `npm run riot:check` — valide la clé avant d'aller plus loin.
   `npm run riot:check -- "Pseudo#TAG"` valide en plus la résolution d'un compte.
4. `npm run dev`, puis `/admin` → ajouter les comptes, un Riot ID par ligne.
5. « Relever maintenant » pour le premier relevé, ou attendre le relevé
   automatique.

## Ce que coûte un cycle

Deux appels par joueur sont systématiques : le rang (`league-v4`) et l'état
« en partie » (`spectator-v5`). L'historique (`match-v5`) n'est demandé que
lorsque `wins + losses` a bougé depuis le dernier relevé — donc lorsque le
joueur a réellement joué.

| Plateau | Cycle courant | Cycle où 6 joueurs ont joué |
| --- | --- | --- |
| 32 joueurs | ~64 appels | ~76 appels |

Le quota d'une clé personnelle est de 20 appels/s et 100 appels/2 min, et
`RateLimiter` (dans `client.ts`) tient deux fenêtres glissantes calées un cran
en dessous. Un relevé toutes les 5 minutes reste donc très loin du plafond. Le
premier relevé d'un plateau neuf est plus lourd (résolution + 20 parties par
joueur) : compter une à deux minutes, le limiteur étale les appels.

**Détail complet des 5 dernières parties** (`match-details.ts`) ajoute un
appel `timeline` par partie **neuve et non déjà en cache** parmi les 5 plus
récentes d'un joueur — jamais pour tout l'historique. Un match partagé par
plusieurs joueurs suivis (même lobby, ou lobbys de deux ladders différents)
n'est fetché et stocké qu'une fois : `hasMatchDetail` sert de garde avant tout
appel. Coût ponctuel à prévoir le jour où cette fonctionnalité est activée sur
un plateau existant : jusqu'à 5 anciennes parties par compte reçoivent leur
détail à leur prochaine partie jouée (dédupliqué par lobby partagé), pas
d'un coup sur tout le plateau.

## Quand le relevé se déclenche

- **À la visite**, si le dernier relevé dépasse `REFRESH_INTERVAL_MS`
  (5 min par défaut) : `app/ranking/page.tsx` appelle `syncIfStale` dans
  `after()`, donc *après* l'envoi de la réponse — le visiteur n'attend jamais
  l'API Riot. Un verrou de processus empêche deux relevés simultanés.
  Pour un site consulté régulièrement, cela suffit : **aucun cron n'est
  nécessaire**.
- **Par cron**, si l'on veut des relevés même sans visiteur :
  `POST /api/refresh` avec `Authorization: Bearer $REFRESH_SECRET`.
  Attention sur Vercel : l'offre Hobby limite les crons à un par jour, ce qui
  ne convient pas — passer par un cron externe (cron-job.org, une tâche
  systemd) ou par l'offre Pro.
- **À la main**, depuis le bouton « Relever maintenant » de `/admin`.

## Le point qu'aucune API ne résout

`match-v5` ne renvoie **aucun LP**. Le gain d'une partie se déduit de deux
relevés encadrant sa fin, et `fillLpDeltas` (dans `sync.ts`) ne l'attribue que
si `wins + losses` n'a progressé que de 1 entre les deux relevés — sinon deux
parties jouées dans le même intervalle recevraient le même total, ce qui est
faux pour les deux.

Conséquences visibles, et c'est normal :

- les colonnes **24 h**, **±LP** et **courbe** se remplissent progressivement ;
- une partie antérieure au premier relevé affiche `— LP` pour toujours ;
- la variation de place sur 24 h n'apparaît qu'après 24 h de suivi.

Le reste est complet dès le premier relevé : palier, LP, V/D de la saison,
winrate, forme, série, KDA, champions favoris et historique des parties
viennent directement de l'API.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `routing.ts` | les deux familles d'hôtes Riot (régionale / plateforme) |
| `client.ts` | `fetch` limité en débit, 404 attendus, erreurs typées |
| `sync.ts` | le job : résolution, rangs, parties, partie en cours |
| `match-mapping.ts` | conversions partagées entre `sync.ts` et `match-details.ts` |
| `match-details.ts` | détail complet (build, runes, courbe d'or) des 5 dernières parties |
| `snapshot.ts` | projection du stockage vers le modèle des vues, sans réseau |
| `refresh.ts` | verrou de processus, âge minimum, déclenchement |

Le stockage est dans `lib/db/` : une base SQLite (`better-sqlite3`) sous
`LADDER_DATA_DIR`, migrée automatiquement au démarrage (`db/migrations/`).

## Notes d'API

Tous les endpoints utilisés sont en **PUUID** : Riot a retiré les
`summonerId`/`accountId` chiffrés le 20 juin 2025.

| Usage | Endpoint |
| --- | --- |
| Riot ID → puuid | `GET /riot/account/v1/accounts/by-riot-id/{name}/{tag}` (hôte régional) |
| Icône, niveau | `GET /lol/summoner/v4/summoners/by-puuid/{puuid}` |
| Rang | `GET /lol/league/v4/entries/by-puuid/{puuid}` |
| Partie en cours | `GET /lol/spectator/v5/active-games/by-summoner/{puuid}` (404 = hors partie) |
| Historique | `GET /lol/match/v5/matches/by-puuid/{puuid}/ids?queue=420` puis `/matches/{id}` |
| Détail minute par minute | `GET /lol/match/v5/matches/{id}/timeline` — uniquement pour les 5 parties les plus récentes d'un joueur, voir plus haut |

Deux pièges rencontrés, traités dans le code :

- `gameDuration` est en **secondes** quand `gameEndTimestamp` est présent, en
  **millisecondes** sinon ;
- `championName` de `match-v5` n'a pas toujours la casse de la clé Data Dragon
  (`FiddleSticks` contre `Fiddlesticks`), et `spectator-v5` ne renvoie qu'un
  identifiant numérique. `lib/champions.ts`, généré par
  `npm run champions:sync`, fait les deux conversions.

Les parties **refaites** (`gameEndedInEarlySurrender`) sont écartées : Riot ne
les compte ni en victoire ni en défaite, les garder fausserait forme et winrate.
Un compte **sans partie classée en SoloQ** est exclu du tableau et signalé dans
`/admin` plutôt que rangé arbitrairement en Fer IV.

## Derrière un proxy d'entreprise

`fetch` de Node repose sur undici, qui **ignore `HTTP_PROXY`/`HTTPS_PROXY`**.
Sans intervention, tous les appels Riot échouent en `UND_ERR_CONNECT_TIMEOUT`,
ce qui ressemble à une panne de Riot alors que c'est le réseau local.
`instrumentation.ts` installe `EnvHttpProxyAgent` au démarrage du serveur quand
ces variables existent, et ne fait rien quand elles sont absentes — donc rien à
configurer en production.
