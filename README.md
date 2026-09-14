# SOLOQ/LADDER

Suivi de classement League of Legends SoloQ pour un plateau de joueurs choisi.
Reconstruction de la page de classement de [soloqchallenge.gg/ranking][ref], en
français, avec un jeu de données de démonstration en attendant le branchement
sur l'API Riot.

[ref]: https://soloqchallenge.gg/ranking

```bash
npm run dev     # http://localhost:3000 → redirige vers /ranking
npm run build && npm start
npm run lint
```

## Ce qui est là

La page `/ranking` : en-tête avec le leader du jour, faits marquants des 24 h,
coupe apex EUW, compte à rebours de fin de split, podium, et un tableau de
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
app/ranking/page.tsx      point d'entrée serveur : construit le relevé
components/ranking/       en-tête, podium, barre d'outils, tableau, ligne dépliée
components/site/          navigation, bandeau défilant, pied de page
components/ui/            primitives (emblème, rôle, champion, forme, courbe…)
lib/types.ts              modèle de données, calé sur les noms de l'API Riot
lib/lol.ts                LP absolus, libellés de palier, chemins d'assets
lib/ranking.ts            tri, filtres, renumérotation
lib/mock.ts               jeu de données de démonstration (déterministe)
lib/riot/README.md        plan de branchement sur l'API Riot
data/roster.ts            le plateau suivi — le seul fichier à éditer
public/lol/               emblèmes, icônes de rôle, 173 champions, drapeaux
public/fonts/             General Sans + IBM Plex Mono, auto-hébergées
```

## Deux principes qui expliquent le code

**Les LP sont ramenés à une échelle unique.** `absoluteLp()` projette Fer IV →
Challenger sur une droite continue (400 LP par palier, Maître et au-dessus
partageant la même base). C'est ce qui permet de trier un tableau qui mélange
Diamant et Challenger sans cas particulier dans les vues — et pourquoi la
colonne LP n'est pas monotone : Maître 35 LP passe devant Diamant I 62 LP.

**Le jeu de démonstration est cohérent, pas rempli au hasard.** L'historique de
LP est reconstruit à partir des deltas réels des parties, le bilan 24 h est
calculé sur les parties de la fenêtre, la variation de place est la différence
entre le classement du jour et celui obtenu en retirant les LP des 24 h, le KDA
et les champions favoris sont agrégés depuis les parties. Aucun chiffre affiché
ne contredit un autre. La graine est fixe : le classement ne se réordonne pas à
chaque rechargement.

## Vérifications faites

- `npm run build` et `npx eslint .` sans erreur ni avertissement
- contraste : 612 éléments de texte mesurés à 1440 px, 416 à 390 px —
  **aucun échec AA**, minimum relevé 4.76:1
- focus clavier : anneau acide de 2 px sur les 14 premières tabulations
- cibles tactiles à 390 px : aucune sous 24 × 24 px
- `prefers-reduced-motion` : aucune animation résiduelle, aucun bloc laissé
  invisible
- aucun débordement horizontal à 390 / 820 / 1200 / 1280 / 1440 / 1600 px
- poids transféré de `/ranking` : ~445 Ko dont 134 Ko de polices et 158 Ko de JS

## Données et marques

Emblèmes de palier, icônes de rôle, portraits de champions et icônes de profil
proviennent de Data Dragon et Community Dragon (Riot Games). Les drapeaux
viennent de flagcdn.com. Les joueurs du plateau de démonstration sont fictifs.
Ce projet n'est ni approuvé par Riot Games ni lié à Riot Games.
