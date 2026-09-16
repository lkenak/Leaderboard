# SOLOQ/LADDER

Plateforme de classements League of Legends SoloQ pour un petit groupe (une
vingtaine de joueurs, typiquement) : chacun se connecte avec Discord, crée son
propre ladder (un groupe de comptes Riot — le sien et ceux de ses amis) et
retrouve dans « mes ladders » tous ceux où apparaît un compte qu'il a déclaré
comme sien, même créés par quelqu'un d'autre. Mise en page inspirée de
[soloqchallenge.gg/ranking][ref], sans les éléments pensés pour un classement
régional (paliers séparés, coupe apex) plutôt que pour un groupe d'amis.

[ref]: https://soloqchallenge.gg/ranking

```bash
npm run dev            # http://localhost:3000
npm run build && npm start
npm run lint
npm run riot:check     # valide la clé Riot avant tout le reste
npm run champions:sync # régénère la table des champions après un patch
npm run migrate:legacy # migration one-shot d'un ancien store.json (voir plus bas)
```

## Démarrer avec de vraies données

1. Prendre une clé **personnelle** sur
   [developer.riotgames.com](https://developer.riotgames.com) →
   *Register Product* → **Personal**. La clé de développement obtenue en deux
   clics **expire toutes les 24 h** ; la personnelle, non — et elle s'obtient
   sans vérification, ce qui correspond exactement à un site privé.
2. Créer une application sur le [portail développeurs
   Discord](https://discord.com/developers/applications), lui ajouter le
   redirect URI `http://localhost:3000/api/auth/callback/discord` (OAuth2 →
   Redirects), noter Client ID et Client Secret.
3. `cp .env.example .env.local` et y coller la clé Riot, le Client ID/Secret
   Discord, et un `AUTH_SECRET` généré (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
   `.env*` est ignoré par git : **rien de tout ça ne doit être commité**, ce
   dépôt est public.
4. `npm run riot:check` pour vérifier que la clé Riot répond.
5. `npm run dev`, se connecter avec Discord, créer un ladder depuis
   **`/ladders/new`**, puis coller les Riot ID (`Pseudo#TAG`) de ses réglages
   (**`/l/<slug>/settings`**). Rang, icône, poste, historique et état « en
   partie » sont résolus automatiquement.

Sans compte ajouté, un ladder affiche un état vide plutôt qu'un plateau
fictif — pas de démonstration trompeuse, ce que tu vois est ce qui existe
vraiment.

Détails du branchement, coût en appels, déclenchement des relevés et pièges
d'API : **[`lib/riot/README.md`](lib/riot/README.md)**.

## Ce qui est là

**`/login`** : connexion Discord (Auth.js). Une fois connecté, **`/`** renvoie
sur le classement de son *ladder d'accueil* — celui qui suit le plus de
comptes parmi les siens : on atterrit sur du contenu, pas sur une page de
gestion. Le sélecteur de l'en-tête permet de passer d'un ladder à l'autre.

**`/ladders`** : le hub — ses ladders et ceux où l'on apparaît, en cartes
avec aperçu du classement (leader, palier, LP, comptes en jeu), plus
**`/ladders/new`** pour en créer un. **`/profil`** : ses comptes Riot déclarés
(sans vérification de propriété), dont celui marqué **principal** — le seul
auquel le futur bot Discord reliera l'utilisateur.

**`/l/[slug]/settings`** : réglages d'un ladder, réservés à son propriétaire.
Un champ pour coller un Riot ID, la liste des comptes avec leur rang relevé,
le nombre de relevés et de parties connues, le retrait, et l'état du
branchement (clé, erreurs, date du dernier relevé).

**`/l/[slug]`** : public. En-tête avec le leader du jour, faits marquants des
24 h, compte à rebours de fin de split, podium, et un tableau de **dix
colonnes** — place et variation, joueur (favori, avatar, drapeau, Riot ID),
rôle, palier, bilan, variation 24 h, forme, ±LP moyens, KDA, champions, courbe
de LP, lien profil. Un seul classement par ladder : pas de découpage en
paliers, pensé pour un groupe d'une vingtaine de joueurs plutôt que pour un
serveur entier.

Interactions : recherche, filtres rôle / pays / en partie / favoris, tri par
colonne, bilan cyclable (V·D → différentiel → parties), dépliage d'une ligne
sur son historique de parties et ses agrégats, choix du site de statistiques
(OP.GG, U.GG, DeepLoL, LeagueOfGraphs).

Les préférences — favoris, mode de bilan, site de statistiques — sont
mémorisées dans le navigateur, par ladder.

## Structure

```
app/l/[slug]/page.tsx     classement public d'un ladder — état vide si aucun compte
app/l/[slug]/settings/    réglages du ladder + Server Actions, réservé au propriétaire
app/ladders/              hub : cartes des ladders (possédés + découverts) et création
app/profil/               comptes Riot déclarés, choix du compte principal
app/page.tsx              landing hors connexion ; connecté, redirige vers le ladder d'accueil
app/login/                connexion Discord
app/api/auth/             route handler Auth.js
app/api/refresh/          déclenchement d'un relevé par cron
lib/header.ts             contexte de l'en-tête (session + ladders du sélecteur)
proxy.ts                  garde /ladders* et /profil derrière une session (Edge Runtime)
instrumentation.ts        migrations DB au démarrage + proxy d'entreprise, s'il y en a un
components/ranking/       en-tête, podium, barre d'outils, tableau, ligne dépliée
components/settings/      formulaire d'ajout, relevé manuel
components/ladders/       déclaration de « mes comptes Riot »
components/site/          navigation, bandeau défilant, bandeau d'état, pied
components/ui/            primitives (emblème, rôle, champion, forme, courbe…)
lib/types.ts              modèle de données, calé sur les noms de l'API Riot
lib/lol.ts                LP absolus, libellés de palier, chemins d'assets
lib/ranking.ts            tri, filtres, renumérotation
lib/auth.ts / auth.config.ts  Auth.js — session complète / config sans accès disque (Edge)
lib/db/                   base SQLite : utilisateurs, ladders, appartenances, comptes Riot
db/migrations/            schéma SQL versionné, appliqué automatiquement au démarrage
lib/riot/                 client, synchronisation, projection vers les vues
lib/champions.ts          généré depuis Data Dragon — ne pas éditer
scripts/migrate-store-to-sqlite.mjs  migration one-shot depuis un ancien store.json
public/lol/               emblèmes, icônes de rôle, 173 champions, drapeaux
public/fonts/             General Sans + IBM Plex Mono, auto-hébergées
```

## Trois principes qui expliquent le code

**Les LP sont ramenés à une échelle unique.** `absoluteLp()` projette Fer IV →
Challenger sur une droite continue (400 LP par palier, Maître et au-dessus
partageant la même base). C'est ce qui permet de trier un tableau qui mélange
Diamant et Challenger sans cas particulier dans les vues — et pourquoi la
colonne LP n'est pas monotone : Maître 35 LP passe devant Diamant I 62 LP.

**On ne stocke qu'une série temporelle : le rang.** `match-v5` ne renvoie aucun
LP, donc le gain d'une partie n'existe nulle part dans l'API : il se déduit de
deux relevés encadrant sa fin. C'est la seule raison pour laquelle ce projet a
besoin d'un stockage, et c'est aussi pourquoi les colonnes *24 h*, *±LP* et
*courbe* se remplissent progressivement après le branchement, là où le palier,
les LP, le winrate, la forme et les champions sont complets dès le premier
relevé.

**Ce qui n'est pas connu s'affiche comme inconnu.** Un gain de LP qu'aucun
relevé n'encadre montre `— LP`, pas `±0` ; une fenêtre de 24 h plus courte que
24 h le dit en infobulle ; un compte sans partie classée est exclu du tableau
et signalé dans les réglages du ladder au lieu d'être rangé en Fer IV.

## Vérifications faites

- `npm run build` et `npx eslint .` sans erreur ni avertissement
- connexion Discord, création de ladder, ajout de compte et découverte
  croisée (« mes comptes ») vérifiées au navigateur
- réglages d'un ladder : Riot ID mal formé refusé, ajout, doublon refusé,
  bascule de sélection, retrait, relevé sans clé, relevé avec clé invalide,
  accès refusé à qui n'est pas propriétaire
- états dégradés vérifiés : sans clé, ladder vide, sélection vide, clé
  refusée — la page reste affichable et explique quoi faire
- contraste : 612 éléments de texte mesurés à 1440 px, 416 à 390 px —
  **aucun échec AA**, minimum relevé 4.76:1
- focus clavier : anneau acide de 2 px sur les 14 premières tabulations
- cibles tactiles à 390 px : aucune sous 24 × 24 px
- `prefers-reduced-motion` : aucune animation résiduelle, aucun bloc laissé
  invisible
- aucun débordement horizontal à 390 / 820 / 1200 / 1280 / 1440 / 1600 px
- poids transféré d'un ladder : ~445 Ko dont 134 Ko de polices et 158 Ko de JS

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `RIOT_API_KEY` | clé personnelle Riot. Absente → aucun compte ne peut être relevé. |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | application Discord (OAuth2), pour la connexion. |
| `AUTH_SECRET` | signature des sessions Auth.js. |
| `AUTH_TRUST_HOST` | `true` dès qu'un reverse proxy (Caddy…) est devant le site. |
| `REFRESH_SECRET` | protège `POST /api/refresh`. Absente → route fermée en production. |
| `REFRESH_INTERVAL_MS` | âge au-delà duquel une visite déclenche un relevé (5 min par défaut). |
| `SPLIT_NAME` | libellé affiché du split. |
| `SPLIT_ENDS_AT` | date ISO de fin de split ; absente → pas de compte à rebours. |
| `LADDER_DATA_DIR` | dossier contenant `ladder.sqlite` (`.data/` par défaut). |

## Données et marques

Emblèmes de palier, icônes de rôle, portraits de champions et icônes de profil
proviennent de Data Dragon et Community Dragon (Riot Games). Les drapeaux
viennent de flagcdn.com. Ce projet n'est ni approuvé par Riot Games ni lié à
Riot Games.
