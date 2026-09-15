# Audit slop UI — SOLOQ/LADDER

Grille : `.claude/skills/antislop-ui/SKILL.md` et `DESIGN.md`.
Passe d'audit le 2026-09-15, corrections appliquées le même jour.

> Réserve de méthode : le skill `antislop-ui` référence des règles `R-XX` et
> `C-X` définies dans un fichier `antislop.md` (le core) qui n'est pas dans le
> dépôt. Les numéros cités sont repris tels que le skill les nomme, sans que
> leur formulation d'origine ait pu être vérifiée.

## Ce qui tenait déjà

La direction artistique était écrite en tête de `app/globals.css` — trois
signaux chromatiques nommés, interdiction explicite du glassmorphism, du halo
et du dégradé multicolore. C'est la moitié du travail que le skill demande, et
ça se voyait dans le code.

| Point de la checklist | Constat |
| --- | --- |
| Palette (R-01, R-29) | Deux signaux + un neutre, rampe de gris froids. Pas de bleu-violet. Ratios de contraste mesurés et annotés. |
| Emoji (R-04) | Aucun, dans tout le dépôt. |
| Verre (R-10) | Deux occurrences, toutes deux sur des barres collantes. Pile au plafond de dose. |
| Rayons (R-11) | 2/3/5/8 px. Aucun `rounded-full` sur un bouton, un champ ou une carte. |
| Ombres (R-12) | Une seule, sur `Popover` — élévation réelle. |
| Icônes (R-04) | SVG écrits à la main, pas de Lucide, pas de sparkle ni de robot. |
| Typo (R-06) | General Sans + IBM Plex Mono, hors du roster par défaut, avec la raison écrite. |
| Faux terminal, bento, 3 colonnes de prix | Absents. |
| États vides (R-27) | Distingués : « aucun joueur dans cette sélection » ≠ « aucun joueur ne correspond au filtre » + bouton de réinitialisation. |
| Données fictives (R-38) | `StatusBanner` nomme la cause (pas de clé / pas de compte) **et** l'action. Traité mieux que la règle n'exige. |
| Mouvement réduit | `prefers-reduced-motion` coupé en CSS **et** honoré en JS dans `Reveal`. |
| Hiérarchie sans médailles | `PositionBadge` : une teinte, quatre crans d'intensité. `PositionDelta` : pas de flèche pour « stable ». |

## Statut des constats

| # | Constat | Statut |
| --- | --- | --- |
| 1 | `bg-screen` / `text-screen` — deux tokens inexistants | Corrigé |
| 2 | Trois points pulsés sur quatre ne marquaient aucun état | Corrigé |
| 3 | Pied de page : 11 faux liens sur 12 | Corrigé |
| 4 | Deux animations décoratives en boucle infinie | Corrigé |
| 5 | Trames de fond, dont une en couleur d'accent | Corrigé |
| 6 | Deux placeholders inventés (`Voltaic` / `VLT`) | Corrigé |
| 7 | Structure ARIA du tableau incomplète | Corrigé, autrement qu'annoncé |
| 8 | Thème sombre imposé sans justification écrite | Documenté (`DESIGN.md` § 7) |
| 9 | Faits du jour calculés sur zéro partie | Corrigé |
| 10 | Podium absent en dessous de trois joueurs | Corrigé |
| 11 | Le leader affiché trois fois avant le classement | Corrigé |
| 12 | Compteur « EN JEU » global posé sur une vue filtrée | Corrigé |
| 13 | `fade-x` : utilitaire mort | Supprimé |

Les constats 9 à 13 ont été trouvés pendant la correction, pas pendant
l'audit. Les 12 et 13 ne sont apparus qu'en inspectant le HTML rendu — ils
étaient invisibles à la lecture du code.

## Détail des corrections

### 1. Deux couleurs mortes

`Header.tsx` et `StreamLink.tsx` utilisaient `bg-screen` et `text-screen`.
Aucun token `--color-screen` n'existe dans `@theme` : les deux classes ne
produisaient rien.

- **En-tête** : le point de l'indicateur « N EN JEU » était transparent. Il
  passe à l'acide, signal de la partie en cours (`DESIGN.md` § 3).
- **StreamLink** : la racine était plus profonde que « mauvais token ». La prop
  `live` n'avait **aucune source de données** — `StreamerHandle` ne porte pas
  ce champ, aucune API de plateforme n'est interrogée, et aucun appelant ne
  passait la prop. Lui donner une couleur aurait créé un signal que rien
  n'alimente. La prop est retirée, avec la note de ce qu'il faudra brancher.

### 2. Points pulsés décoratifs

`LiveDot.tsx` affirmait en commentaire être « une seule animation infinie sur
la page […] jamais de la décoration ». C'était faux sur les deux points.

| Emplacement | État marqué | Traitement |
| --- | --- | --- |
| `cells.tsx` (chip de profil) | joueur en partie | Conservé — état réel |
| `PageHeader` (« Relevé ») | aucun : `live` passé en dur | Supprimé |
| `Header` (« N EN JEU ») | pulsait même à zéro | Conditionné à `liveCount > 0` |
| `Toolbar` (« En partie ») | l'état du filtre, pas un direct | Disque plein statique |

Les trois conditions cumulatives du témoin de direct sont maintenant écrites
dans `DESIGN.md` § 6 et dans la docstring de `LiveDot`.

### 3. Pied de page

Trois colonnes de quatre entrées, dont onze `<span className="cursor-default">`
sans destination et sans mention « bientôt » — mais avec un effet de survol.
Une fausse affordance est pire qu'un lien mort : elle invite le clic.

Reconstruit autour de ce qui existe : deux liens internes réels, deux sources
de données qui sont de vrais liens externes (`developer.riotgames.com`, Data
Dragon), et les sections à venir regroupées sous la convention `SOON` déjà
utilisée par la navigation de l'en-tête. Quatre colonnes deviennent trois
blocs de largeurs différentes.

### 4. Boucles infinies

- **Balayage du filet du tableau** (`Ladder.tsx`) — un dégradé acide traversait
  le haut du tableau en continu, censé « signaler une donnée qui se
  rafraîchit ». Il tournait aussi quand rien ne se rafraîchissait, y compris en
  mode démonstration où rien ne se rafraîchira jamais. C'était le seul dégradé
  du projet, en couleur d'accent, en mouvement perpétuel : trois plafonds de
  dose touchés d'un coup. Supprimé — « Relevé · il y a 3 min » porte
  l'information, en plus précis.
- **Ruban défilant** (`Ticker.tsx`) — 60 s en boucle, `aria-hidden`, et son
  propre commentaire admettait que l'information était déjà dans le tableau.
  Composant supprimé. C'est le choix le plus discutable de la passe : un ruban
  de résultats est un motif crédible pour le genre. Il a été tranché par la
  redondance, pas par le mouvement seul — le bandeau de faits répond à la même
  question (« qui a bougé ? ») de façon triée, lisible et accessible.

### 5. Trames de fond

Trois calques fixes empilés dans `layout.tsx` : quadrillage de 56 px, nappe de
points, dégradé de fermeture. Le quadrillage est nommément le motif
« Background Grid » (R-07). La nappe posait un second problème : ses points
étaient en `rgba(233, 255, 31, 0.35)`, soit l'acide — la couleur qui ne doit
signaler que quatre choses — étalé sur 420 px de fond de page.

Il reste une seule couche : le grain, qui est un motif d'identité déclaré
(`DESIGN.md` § 8). Les utilitaires `gridlines` et `dotfield` sont supprimés.

### 6. Placeholders inventés

`Voltaic` / `VLT` → `Nom de l'équipe` / `TAG`. Les autres champs du même
formulaire faisaient déjà ce qu'il faut (`Pseudo#TAG`, `FR`).

### 7. Structure ARIA — corrigé autrement qu'annoncé

L'audit demandait d'ajouter `role="cell"` et `role="rowgroup"`. En le faisant,
le diagnostic s'est révélé incomplet : ce composant **ne peut pas** être une
table ARIA valide. Le panneau de détail dépliable — deux onglets, un tableau
d'historique — ne tient pas dans une cellule, et la ligne est cliquable dans
son entier.

Déclarer une table qu'on ne peut pas honorer est pire que ne pas en déclarer.
Le classement est donc déclaré pour ce qu'il est :

- `role="list"` autour des seules lignes (une liste ne peut contenir que des
  `listitem` : ni l'en-tête de tri, ni un état vide) ;
- chaque ligne `role="button"` + `aria-expanded`, le motif « disclosure » ;
- chaque ligne porte un **résumé vocal** — « 3e, Nom #TAG, Diamant II, 1240 LP,
  +18 LP sur 24 heures, 62 % de victoires sur 180 parties ». Un lecteur d'écran
  qui balaye un classement veut la ligne d'un coup, pas douze cellules à
  recoller ;
- la barre d'en-tête devient un `role="group"` nommé « Trier le classement » :
  ses boutons restent annoncés, elle ne se fait plus passer pour une `row` ;
- la vue en fiches portait `tabIndex` mais **pas** `aria-expanded` : elle
  ouvrait le même panneau sans jamais annoncer qu'elle était dépliable. Les
  deux vues partagent maintenant le même contrat.

Limite assumée : la ligne-bouton contient des contrôles (favori, lien profil).
C'est le compromis habituel d'une ligne cliquable ; le motif formellement exact
serait un `treegrid` avec navigation par flèches, hors périmètre de cette passe.

### 9. Faits du jour sur zéro partie

Le bandeau affichait ses trois faits dès qu'il existait une entrée, en triant
une liste de zéros — donc « Meilleure progression · +0 LP » en début de
journée. Trois faits inventés par un tri.

Chaque fait doit maintenant être vrai pour s'afficher : une progression
au-dessus de zéro, une chute en dessous, une série à partir de deux parties.
La grille s'adapte au nombre de faits réels, et le bandeau disparaît quand il
n'y a rien à dire.

### 10. Podium sous trois joueurs

`if (top.length < 3) return null` : un plateau de deux comptes n'avait pas de
podium du tout, sans que rien ne l'explique. Il montre maintenant ce qu'il a,
et la grille suit le nombre réel de cartes.

### 11. Le leader affiché trois fois

C'était la principale faiblesse de structure, et elle n'était pas dans l'audit
initial. Avant le classement, le lecteur croisait : une carte « Leader », puis
un podium dont la première carte est le même joueur, puis la première ligne du
tableau. Trois fois le même nom avant la première réponse. Même chose pour
l'horodatage, affiché trois fois (méta de l'en-tête, chapeau de section, pied
de page).

- La carte « Leader » est remplacée par la **coupe apex** et le **compte à
  rebours de split**, qui ne sont nulle part ailleurs — et qui étaient enterrés
  dans le chapeau du tableau derrière un `hidden lg:block`, donc invisibles sur
  la moitié des écrans.
- Le chapeau de section disparaît : son titre « Classement » redisait
  l'intitulé du H1, et son « dernier relevé » était le troisième affichage de
  la même minute. Restent deux formes distinctes — relatif en en-tête, heure
  absolue en pied de page.
- Le podium gagne une seconde dimension de hiérarchie : la première carte
  occupe deux colonnes sur quatre à partir de `lg`. Trois cartes de taille
  égale mettent les trois joueurs au même rang visuel, ce qu'un podium doit
  précisément démentir.

Résultat : le classement démarre plus haut, et chaque bloc au-dessus répond à
une question qu'aucun autre ne traite.

### 12. Compteur « EN JEU »

Trouvé en comparant le HTML rendu au code : l'en-tête annonçait « 6 EN JEU »
alors que la sélection affichée n'en montrait que 4. `liveCount` est calculé
sur **tous** les snapshots (high elo + low elo) dans `app/ranking/page.tsx`,
alors que le tableau n'affiche qu'une sélection.

Le chiffre est juste pour ce qu'il compte — c'est un indicateur de plateau,
dans l'en-tête du site, pas dans la page. Mais rien ne le disait. Il porte
maintenant un `title` qui nomme son périmètre. Le rendre égal à la vue
demanderait de faire descendre l'en-tête dans le composant client qui détient
la sélection : disproportionné pour le gain.

## Vérifications

- `npm run build` — vert, TypeScript compris (5 routes).
- `npm run lint` — aucun avertissement.
- Serveur de production interrogé sur `/ranking` et `/admin` : plus aucune
  trace de `gridlines`, `dotfield`, `animate-sweep`, `animate-ticker`,
  `role="table"` ni de la carte « Leader » ; un seul `h1`, hiérarchie de titres
  continue ; les quatre liens du pied de page résolvent ; les 9 points pulsés
  restants correspondent exactement aux 4 joueurs en partie de la sélection
  affichée (× 2 vues) plus celui de l'en-tête.
- `/admin` est derrière authentification, donc les placeholders du formulaire
  ne sont couverts que par la compilation, pas par le rendu.

## Ce qui reste ouvert

- **Navigation** : quatre sections annoncées `SOON` dans l'en-tête et le pied
  de page (`/live`, `/equipes`, `/historique`, `/tierlist`). Correctement
  étiquetées, donc conformes — mais ce sont quatre promesses.
- **`treegrid`** : le motif ARIA exact pour une ligne dépliable contenant des
  contrôles (cf. constat 7).
- **Direct des chaînes** : aucune API de plateforme n'est interrogée. Le jour
  où elle le sera, le direct se marque en brasier et la prop `live` de
  `StreamLink` revient avec sa source.
- **Thème clair** : écarté par décision, pas par oubli (`DESIGN.md` § 7). Les
  emblèmes de palier sont détourés sur fond sombre ; un mode clair demanderait
  un second jeu d'assets.
