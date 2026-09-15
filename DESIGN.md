# Direction artistique — SOLOQ/LADDER

Ce document est la référence. `app/globals.css` l'applique ; en cas d'écart,
c'est le CSS qui a tort. Toute relecture d'interface se fait avec
`.claude/skills/antislop-ui/SKILL.md` **et** ce fichier.

## 1. L'objet

Un classement SoloQ pour un plateau de joueurs choisi. Pas un tableau de bord,
pas une page de présentation : un **classement**, c'est-à-dire un tableau qu'on
vient scanner, plusieurs fois par jour, pour répondre à trois questions dans
cet ordre :

1. Qui est en tête, et de combien ?
2. Où en est le joueur que je suis ?
3. Qui a bougé depuis hier ?

La décision que prend le lecteur est de **cliquer une ligne** pour voir
l'historique d'un joueur. Toute la hiérarchie sert ce geste : ce qui n'aide ni
à scanner, ni à situer, ni à cliquer n'a pas sa place.

Conséquence directe, et c'est la règle la plus contraignante du document :
**une information ne s'affiche qu'une fois.** Un classement dont le leader
apparaît dans une carte, puis sur un podium, puis en première ligne, fait
scroller trois fois avant la première réponse.

## 2. Le lecteur

Un joueur de League of Legends, le soir, sur un écran large ou sur son
téléphone entre deux parties. Il connaît les paliers, les LP, les rôles : le
vocabulaire du jeu n'a pas à être traduit. Il ne lit pas la page, il la
balaye — donc les chiffres s'alignent, les colonnes ont une largeur fixe, et
rien ne bouge sous ses yeux pendant qu'il lit.

## 3. Palette

Trois signaux, jamais plus. Chacun a un rôle unique et exclusif : si une
couleur apparaît ailleurs que dans son rôle, c'est une erreur.

| Signal | Valeur | Rôle exclusif |
| --- | --- | --- |
| Acide | `#E9FF1F` | La marque, le gain de LP, la 1re place, la partie en cours |
| Brasier | `#FF2D55` | La perte de LP, la défaite, le direct d'une chaîne |
| Ciel | `#7DD3FC` | L'identité de la sélection « low elo », et rien d'autre |

Tout le reste est une rampe de gris froids sur un noir bleuté : six surfaces
(`void` → `panel-4`), trois filets (`hair`), quatre crans d'encre (`ink`). Les
teintes de palier (`--color-t-*`) ne sont pas des couleurs de décor : elles
sont portées par les emblèmes et répliquées pour le texte des colonnes triées.
`gold` est le seul emprunt à la charte LoL.

**L'accent se mérite.** L'acide est la couleur la plus agressive de la page ;
elle ne doit apparaître que là où le lecteur doit regarder. Concrètement, elle
est interdite en aplat de fond, en trame, en halo et en bordure décorative.
Un dégradé n'est admis que s'il sépare deux niveaux de hiérarchie, et la raison
s'écrit sur place.

Contraste : la rampe d'encre est mesurée et annotée dans `globals.css`. Le cran
le plus faible (`ink-4`) reste à 4.50:1 sur la surface la plus claire du site.
Un tableau de statistiques n'a aucun texte décoratif — tout y est une donnée,
donc tout y est lisible.

## 4. Typographie

- **General Sans** pour le texte. Une humaniste géométrique aux chiffres
  larges : elle tient les titres courts en gras serré sans le côté « corporate
  neutre » d'Inter, qui est le choix par défaut de tout le monde.
- **IBM Plex Mono** pour tout chiffre de tableau, libellé de colonne et tag.
  Choisie pour son zéro barré (`"zero" 1`) et ses chiffres à chasse fixe : dans
  une colonne de LP, deux nombres doivent s'aligner au pixel.

Sept crans de taille, pas treize. Les libellés de colonne sont en capitales
tracquées à `0.14em` : c'est le vocabulaire du tableau de résultats sportif,
et c'est le **seul** endroit où cette forme est autorisée. Un titre en mono ou
une capitale tracquée hors libellé de colonne est une erreur.

## 5. Géométrie et doses

Rayons serrés — 2, 3, 5, 8 px. L'objet est un instrument de mesure, pas une
application grand public : rien n'est en forme de pilule. `rounded-full` est
réservé aux points d'état et aux ascenseurs.

Plafonds de dose, comptés sur l'ensemble d'une page :

| Effet | Plafond | Où |
| --- | --- | --- |
| Verre (`backdrop-blur`) | 2 | Les deux barres collantes, et elles seules |
| Ombre | 1 | Un calque qui flotte réellement au-dessus du reste |
| Halo | 0 | Proscrit. La hiérarchie passe par l'intensité, pas par la lueur |
| Dégradé | 1 | Et seulement en fonction de hiérarchie |

## 6. Cadrans

Les trois réglages déclarés du projet. Ils tranchent les arbitrages : un écart
au cadran est un défaut, pas un goût.

### RHYTHM — 2 sur 3

Les blocs varient, mais sans rupture de composition. L'en-tête est asymétrique
(7/5), le podium hiérarchise par la taille, le tableau est régulier parce qu'un
tableau *doit* l'être. On ne cherche pas la surprise d'une section à l'autre :
on cherche qu'aucune section ne ressemble à un remplissage. Trois cellules
identiques côte à côte sont acceptables quand les trois faits sont de même
nature ; elles ne le sont pas pour hiérarchiser.

### MOTION — 1 sur 3

**Survol, focus, et révélation unique à l'entrée.** Rien d'autre.

- Autorisé : transitions de couleur (150 ms), révélation au défilement jouée
  **une seule fois** (`Reveal`), barres qui se remplissent une fois.
- Proscrit : toute boucle infinie décorative. Un balayage qui tourne en
  permanence, un ruban qui défile sans fin, un élément qui flotte.
- **Le point d'état pulsé est la seule boucle tolérée**, et sous trois
  conditions cumulatives : il marque un état *réellement* en cours (un joueur
  en partie), il n'y en a qu'un par contexte, et il disparaît quand l'état
  s'éteint. Un point pulsé à côté d'un horodatage ou d'un libellé de filtre est
  un défaut.
- `prefers-reduced-motion` supprime le mouvement, il ne le raccourcit pas.

### DENSITY — 3 sur 3

C'est un classement : la densité est la fonctionnalité. Hauteur de ligne
serrée, douze colonnes révélées par paliers de largeur plutôt qu'un tableau de
1 060 px qui défile horizontalement sur mobile. Sous 768 px, la ligne devient
une fiche — un autre rendu du même composant, pas un tableau rétréci.

## 7. Thème

**Sombre fixe, pas de bascule.** C'est une décision, pas un défaut :

- Le référentiel visuel du lecteur est le client de jeu et les sites de stats
  du jeu, tous sombres. Un classement blanc y serait un corps étranger.
- L'usage réel est nocturne, entre deux parties.
- Les emblèmes de palier et les icônes de champion sont des PNG détourés sur
  fond sombre. Sur fond clair, leurs bords noirs baveraient — il faudrait un
  deuxième jeu d'assets pour un gain nul.

Conséquence assumée : `color-scheme: dark` est déclaré, et il n'y a **pas** de
palette claire à maintenir. Si un jour la page doit vivre en clair, c'est un
chantier de DA, pas un interrupteur.

## 8. Motifs d'identité

Ce qui fait que la page est *celle-ci* et pas une autre :

- **Le parallélogramme** (`skewbox`) — un `clip-path` unique, jamais une
  rotation du contenu. Il marque les puces d'action et les onglets. C'est la
  forme de l'objet.
- **Les hachures à 45°** (`hazard`) — marquent une ligne de coupe
  (qualification, relégation) sans dépenser de couleur.
- **Le grain** (`grain-layer`) — donne une matière au noir. À 3,5 %
  d'opacité en `overlay`, sans introduire de halo.
- **L'emblème de palier en filigrane** — très large, très sombre, coupé par le
  bord de la carte. C'est de la matière, pas une illustration : il vient de la
  donnée du joueur, donc il n'est jamais décoratif.

Proscrit, par opposition : la trame de plan (quadrillage, papier millimétré,
nappe de points) en fond de page. C'est la façon par défaut de rendre une page
plate « technique », et elle ne dit rien de ce produit. Le noir du fond se
suffit ; le grain lui donne sa matière.

## 9. États

Trois écrans différents, trois textes différents. Chacun nomme la **cause**
et l'**action** qui la lève :

| État | Ce qu'il dit |
| --- | --- |
| Premier relevé | Ce qui est en cours, et ce qui se remplira ensuite |
| Sélection vide | Que le problème est en amont, avec le lien vers le plateau |
| Filtré à zéro | Qu'un filtre est en cause, avec le bouton qui le lève |
| Données fictives | Pourquoi (pas de clé, ou pas de compte), et où aller |
| Compte hors classement | Lequel, pourquoi, et où corriger |

« Aucune donnée » tout court est un défaut. Un chiffre inventé, un faux nom
plausible dans un champ, un fait du jour calculé sur zéro partie : défauts
aussi.

**Trois valeurs non renseignées, trois écritures.** `0` est une mesure, pas une
absence — et deux absences de nature différente ne s'écrivent pas pareil :

| Écriture | Sens |
| --- | --- |
| `0`, `+0` | mesuré, et le résultat est nul |
| `—` | il ne s'est rien passé : rien à mesurer |
| `···` | il s'est passé quelque chose, mais la mesure n'est pas encore possible |

Le cas qui impose `···` : un gain de LP est un **différentiel**. L'API Riot ne
fournit pas les LP partie par partie, seulement le rang à l'instant de l'appel,
donc une variation se calcule en encadrant la partie par deux relevés. Un
compte qui vient d'être ajouté a donc un bilan de victoires immédiat mais
aucune variation de LP, et ses parties antérieures au premier relevé n'en
auront jamais. Écrire `—` dans ce cas laisse croire à une panne de collecte.

Quand un `···` apparaît, la page doit aussi dire pourquoi à l'échelle du
bandeau : une infobulle n'est pas une explication, elle demande de savoir qu'il
faut survoler.

## 10. Ce qu'on ne fait pas

- Pas de halo, pas de dégradé bleu-violet, pas de verre partout.
- Pas d'emoji dans l'interface.
- Pas de flèche décorative sur les boutons.
- Pas de lien mort : une destination qui n'existe pas se dit `SOON`, de façon
  visible, avec `aria-disabled`.
- Pas de dot d'état qui ne marque rien.
- Pas de bibliothèque d'icônes importée en bloc : les glyphes sont écrits à la
  main, à la taille où ils servent.
- Pas d'information affichée deux fois.
