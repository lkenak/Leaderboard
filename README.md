# SOLOQ/LADDER

Suivi de classement League of Legends SoloQ pour un plateau de comptes choisi,
branché sur l'API Riot. Reconstruction de la page de classement de
[soloqchallenge.gg/ranking][ref], en français.

[ref]: https://soloqchallenge.gg/ranking

```bash
npm run dev            # http://localhost:3000 → redirige vers /ranking
npm run build && npm start
npm run lint
npm run riot:check     # valide la clé Riot avant tout le reste
npm run champions:sync # régénère la table des champions après un patch
```

## Démarrer avec de vraies données

1. Prendre une clé **personnelle** sur
   [developer.riotgames.com](https://developer.riotgames.com) →
   *Register Product* → **Personal**. La clé de développement obtenue en deux
   clics **expire toutes les 24 h** ; la personnelle, non — et elle s'obtient
   sans vérification, ce qui correspond exactement à un site privé.
2. `cp .env.example .env.local` et y coller la clé.
   `.env*` est ignoré par git : **la clé ne doit jamais être commitée**, ce
   dépôt est public.
3. `npm run riot:check` pour vérifier qu'elle répond.
4. `npm run dev`, puis **`/admin`** : coller les Riot ID (`Pseudo#TAG`), choisir
   la région et la sélection. Rang, icône, poste, historique et état « en
   partie » sont résolus automatiquement.

Sans clé ou sans compte, le site affiche un plateau fictif et le dit dans un
bandeau — il reste présentable, mais ne prétend rien.

Détails du branchement, coût en appels, déclenchement des relevés et pièges
d'API : **[`lib/riot/README.md`](lib/riot/README.md)**.

## Ce qui est là

**`/admin`** : le plateau suivi. Un champ pour coller un Riot ID, la liste des
comptes avec leur rang relevé, le nombre de relevés et de parties connues, la
bascule entre sélections, le retrait, et l'état du branchement (clé, erreurs,
date du dernier relevé). Protégée par `ADMIN_PASSWORD` ; sans mot de passe
défini, la page n'est ouverte qu'en développement local.

**`/ranking`** : en-tête avec le leader du jour, faits marquants des 24 h,
coupe apex, compte à rebours de fin de split, podium, et un tableau de
**douze colonnes** — place et variation, joueur (favori, avatar, drapeau, Riot
ID, équipe, liens de chaîne), rôle, palier, bilan, variation 24 h, forme,
±LP moyens, KDA, champions, courbe de LP, lien profil.

Interactions : trois sélections (Tous / High elo / Low elo, la vue fusionnée
renumérotant tout le monde), recherche, filtres rôle / pays / en partie /
favoris, tri par colonne, bilan cyclable (V·D → différentiel → parties),
dépliage d'une ligne sur son historique de parties et ses agrégats, choix du
site de statistiques (OP.GG, U.GG, DeepLoL, LeagueOfGraphs).

Les préférences — favoris, mode de bilan, site de statistiques — sont
mémorisées dans le navigateur.

## Structure

```
app/ranking/page.tsx      point d'entrée : relevé réel ou démonstration
app/admin/                page du plateau + Server Actions
app/api/refresh/          déclenchement d'un relevé par cron
instrumentation.ts        route fetch par le proxy d'entreprise, s'il y en a un
components/ranking/       en-tête, podium, barre d'outils, tableau, ligne dépliée
components/admin/         formulaire d'ajout, relevé manuel, connexion
components/site/          navigation, bandeau défilant, bandeau d'état, pied
components/ui/            primitives (emblème, rôle, champion, forme, courbe…)
lib/types.ts              modèle de données, calé sur les noms de l'API Riot
lib/lol.ts                LP absolus, libellés de palier, chemins d'assets
lib/ranking.ts            tri, filtres, renumérotation
lib/store.ts              stockage local : plateau, relevés de LP, parties
lib/riot/                 client, synchronisation, projection vers les vues
lib/champions.ts          généré depuis Data Dragon — ne pas éditer
lib/mock.ts               jeu de démonstration déterministe (repli)
data/roster.ts            plateau fictif du mode démonstration
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
24 h le dit en infobulle ; un compte sans partie classée est exclu du tableau et
signalé dans `/admin` au lieu d'être rangé en Fer IV. Le jeu de démonstration
suit la même règle : il est *cohérent* (l'historique de LP découle des deltas
des parties, la variation de place est une vraie différence entre deux
classements) plutôt que rempli au hasard.

## Vérifications faites

- `npm run build` et `npx eslint .` sans erreur ni avertissement
- parcours `/admin` vérifié au navigateur : mot de passe refusé puis accepté,
  Riot ID mal formé refusé, ajout, doublon refusé, bascule de sélection,
  retrait, relevé sans clé, relevé avec clé invalide
- états dégradés vérifiés : sans clé, plateau vide, sélection vide, clé
  refusée — la page reste affichable et explique quoi faire
- contraste : 612 éléments de texte mesurés à 1440 px, 416 à 390 px —
  **aucun échec AA**, minimum relevé 4.76:1
- focus clavier : anneau acide de 2 px sur les 14 premières tabulations
- cibles tactiles à 390 px : aucune sous 24 × 24 px
- `prefers-reduced-motion` : aucune animation résiduelle, aucun bloc laissé
  invisible
- aucun débordement horizontal à 390 / 820 / 1200 / 1280 / 1440 / 1600 px
- poids transféré de `/ranking` : ~445 Ko dont 134 Ko de polices et 158 Ko de JS

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `RIOT_API_KEY` | clé personnelle Riot. Absente → mode démonstration. |
| `ADMIN_PASSWORD` | ouvre `/admin`. Absente → page fermée en production. |
| `REFRESH_SECRET` | protège `POST /api/refresh`. Absente → route fermée en production. |
| `REFRESH_INTERVAL_MS` | âge au-delà duquel une visite déclenche un relevé (5 min par défaut). |
| `SPLIT_NAME` | libellé affiché du split. |
| `SPLIT_ENDS_AT` | date ISO de fin de split ; absente → pas de compte à rebours. |
| `LADDER_DATA_DIR` | emplacement du stockage (`.data/` par défaut). |

## Données et marques

Emblèmes de palier, icônes de rôle, portraits de champions et icônes de profil
proviennent de Data Dragon et Community Dragon (Riot Games). Les drapeaux
viennent de flagcdn.com. Les joueurs du plateau de démonstration sont fictifs.
Ce projet n'est ni approuvé par Riot Games ni lié à Riot Games.
