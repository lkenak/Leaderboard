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
2. La poser, au choix :
   - dans `RIOT_API_KEY` (`cp .env.example .env.local`) — la bonne place pour
     une clé personnelle, qu'on ne touchera plus ;
   - ou **depuis `/admin`**, dans le champ « Coller une clé » — la bonne place
     pour une clé de développement, qu'il faut renouveler chaque jour.
3. `npm run dev`, puis `/admin` → ajouter les comptes, un Riot ID par ligne.
4. « Relever maintenant » pour le premier relevé, ou attendre le relevé
   automatique.

`npm run riot:check` valide une clé placée dans `.env.local` en ligne de
commande ; `npm run riot:check -- "Pseudo#TAG"` valide en plus la résolution
d'un compte. Une clé collée depuis `/admin` est vérifiée à la saisie, il n'y a
rien à lancer.

## La clé saisie depuis `/admin`

Une clé de développement meurt toutes les 24 h, et la renouveler en éditant
`.env.local` demande d'ouvrir un éditeur puis de **relancer le serveur** —
chaque matin. Le champ de `/admin` évite les deux.

- **Ordre de résolution** : clé saisie d'abord, `RIOT_API_KEY` ensuite. Coller
  une clé surcharge donc l'environnement ; « Oublier cette clé » rend la main à
  `RIOT_API_KEY`.
- **Vérifiée avant d'être retenue** : un appel à `challengerleagues` tranche
  tout de suite. Une clé fausse rangée en silence, ce serait un classement qui
  cesse de bouger sans rien dire.
- **Rangée dans `.data/riot-key.json`**, en `0600` — pas dans `store.json`, que
  l'on copie et que l'on colle dans un rapport de bug. Le secret ne voyage pas
  avec les données. Il n'est pas chiffré, et ce serait vain : la clé de
  déchiffrement vivrait sur le même disque, lisible par qui peut déjà lire ce
  fichier.
- **Jamais renvoyée au navigateur** : `keyStatus()` n'expose qu'un masque
  (`RGAPI-xxxx…9f2c`).
- **Le 401 coupe les relevés.** Dès que Riot refuse la clé, le refus est noté
  (par empreinte, pour qu'une clé neuve n'hérite pas du reproche fait à
  l'ancienne), `syncIfStale` s'arrête, et le bandeau du classement dit quoi
  faire. Sans cela, le site cognerait l'API toutes les cinq minutes avec une
  clé morte.
- **Un processus, un cache.** Le fichier est lu une fois par processus. Sur un
  hébergement qui multiplie les instances sans disque partagé — Vercel, par
  exemple — une clé saisie sur l'une n'est pas vue par les autres : là, c'est
  `RIOT_API_KEY` qu'il faut utiliser.

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
| `key.ts` | résolution de la clé : saisie depuis `/admin`, sinon environnement |
| `client.ts` | `fetch` limité en débit, 404 attendus, erreurs typées |
| `sync.ts` | le job : résolution, rangs, parties, partie en cours, coupes apex |
| `snapshot.ts` | projection du stockage vers le modèle des vues, sans réseau |
| `refresh.ts` | verrou de processus, âge minimum, déclenchement |

Le stockage est dans `lib/store.ts` : un fichier JSON sous `.data/`, écrit de
façon atomique et sérialisée. Pour déployer sur un hébergement au système de
fichiers en lecture seule, il suffit de réimplémenter `read` et `update` sur
Postgres — rien d'autre ne touche au disque.

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
| Coupe apex | `GET /lol/league/v4/{challenger,grandmaster}leagues/by-queue/RANKED_SOLO_5x5` |

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
