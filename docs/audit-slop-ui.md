# Audit slop UI — SOLOQ/LADDER

Grille : `.claude/skills/antislop-ui/SKILL.md`. Passe faite le 2026-09-15.

**Périmètre :** l'audit porte sur le *working tree* de `main` au moment de la
passe, c'est-à-dire le commit `b47bd0c` **plus les modifications non
commitées** — dont le travail en cours sur la clé Riot (`app/admin/`,
`lib/riot/`, `StatusBanner.tsx`). Les numéros de ligne cités s'y réfèrent. Ce
rapport vit dans une branche partie de `origin/main`, qui ne contient pas ces
fichiers : vérifier les lignes contre le checkout principal, pas contre la
branche du rapport. Chaque constat a été recontrôlé sur le checkout principal.

> Réserve de méthode : le skill `antislop-ui` référence des règles `R-XX` et
> `C-X` définies dans un fichier `antislop.md` (le core) qui n'est pas dans le
> dépôt. Les numéros cités ci-dessous sont donc repris tels que le skill les
> nomme, sans que leur formulation d'origine ait pu être vérifiée.

## Ce qui tient

La direction artistique est écrite, en tête de `app/globals.css` : trois
signaux chromatiques nommés, avec leur rôle, et une interdiction explicite du
glassmorphism, du halo et du dégradé multicolore. C'est la moitié du travail
que le skill demande, et ça se voit dans le code.

| Point de la checklist | Constat |
| --- | --- |
| Palette (R-01, R-29) | Deux signaux + un neutre, rampe de gris froids. Pas de bleu-violet. Les ratios de contraste sont mesurés et annotés dans le CSS. |
| Emoji (R-04) | Aucun, dans tout le dépôt. |
| Glass (R-10) | Deux occurrences, toutes deux sur des barres collantes (`Header`, `LadderHead`), derrière `supports-[backdrop-filter]`. Pile au plafond de dose. |
| Rayons (R-11) | 2/3/5/8 px. Aucun `rounded-full` sur un bouton, un champ ou une carte. |
| Ombres (R-12) | Une seule, sur `Popover` — élévation réelle. |
| Icônes (R-04) | SVG écrits à la main, pas de Lucide, pas de sparkle ni de robot. |
| Typo (R-06) | General Sans + IBM Plex Mono, hors du roster par défaut, avec la raison écrite. |
| Faux terminal, bento, 3 colonnes de prix | Absents. |
| États vides (R-27) | Bien faits, et surtout **distingués** : « aucun joueur classé dans cette sélection » (en amont) ≠ « aucun joueur ne correspond à ce filtre » + bouton de réinitialisation (action). C'est exactement ce que la règle demande. |
| Données fictives (R-38) | `app/ranking/page.tsx` affiche un `StatusBanner` « Données de démonstration » qui nomme la cause (pas de clé / pas de compte) **et** l'action (`/admin`). Le commentaire de `StatusBanner.tsx` explique même pourquoi. Traité mieux que la règle n'exige. |
| Clavier (C-4) | Les lignes du classement ont `tabIndex={0}`, `onKeyDown` et `aria-expanded`. Un seul style de focus pour tout le site. |
| Mouvement réduit | `prefers-reduced-motion` coupé au niveau CSS **et** honoré en JS dans `Reveal`. |

## Les constats

Classés par gravité.

### 1. Deux couleurs mortes — `bg-screen`, `text-screen`

**Fichiers :** `components/site/Header.tsx:88`, `components/ui/StreamLink.tsx:39`

Aucun token `--color-screen` n'existe dans `@theme`. Les deux classes ne
produisent donc rien.

Conséquences visibles :

- Le point de l'indicateur « N EN JEU » de l'en-tête est **transparent**. Il
  pulse dans le vide.
- Sur `StreamLink`, l'état `live` d'une chaîne n'est pas coloré : le lien d'un
  streamer en direct est rendu exactement comme celui d'un streamer hors ligne.
  La DA annonce pourtant « brasier #FF2D55 — […] le direct d'une chaîne ».

Correctif : `bg-blaze` / `text-blaze`, conformément à la DA. Ou ajouter le
token s'il manque volontairement — mais alors la DA doit le nommer.

### 2. Trois points pulsés sur quatre ne marquent aucun état réel

C'est le motif « Decorative Status Dot » (R-19, R-31), et il est présent trois
fois. `LiveDot.tsx` affirme en commentaire être « une seule animation infinie
sur la page […] jamais de la décoration » — l'affirmation est fausse sur les
deux points.

| Emplacement | État marqué | Verdict |
| --- | --- | --- |
| `cells.tsx:225` | `entry.live !== null` — le joueur est en partie | Légitime |
| `PageHeader.tsx:70` | **aucun** : `live` est passé en dur au `<Meta label="Relevé">` | Décoratif |
| `Header.tsx:88` | pulse même quand `liveCount === 0` | Décoratif (et invisible, cf. 1) |
| `Toolbar.tsx:146` | l'état du **filtre** `inGameOnly`, pas un direct | Décoratif |

Le cas `PageHeader` est le plus net : le point pulse en permanence à côté de
« il y a 3 min », alors qu'aucun relevé n'est en cours à ce moment-là. Il
emprunte le vocabulaire du direct pour un fait qui n'existe pas.

Correctifs :
- `PageHeader` : supprimer `live`, ou le conditionner à un vrai relevé en vol.
- `Header` : n'afficher la pastille que si `liveCount > 0`.
- `Toolbar` : un filtre n'a pas besoin d'un témoin de direct ; l'état actif du
  bouton le dit déjà. Un disque plein suffit.

À noter que même sur l'usage légitime, R-19 demande de supprimer la boucle
infinie. Le pulse « live » est une convention établie, donc c'est arbitrable —
mais il faut alors l'écrire dans la DA, et un seul dot doit survivre.

### 3. Pied de page : 11 faux liens sur 12

**Fichier :** `components/site/Footer.tsx`

Trois colonnes de quatre items. Un seul est un vrai lien (`/admin`). Les onze
autres sont des `<span className="cursor-default">` — sans destination, et
**sans label « Bientôt »**. C'est le cumul de deux motifs du skill :
« 4-Column Template Footer » (R-05) et « Dead Navigation » (R-24).

Aggravant : ces spans portent `hover:text-ink-2`. Ils réagissent au survol
comme un lien tout en étant inertes. Une fausse affordance est pire qu'un lien
mort — elle invite le clic.

Le `Header`, lui, traite le même problème correctement : badge `SOON` +
`aria-disabled` + `title="Bientôt"`. Le pied de page doit suivre cette
convention, ou perdre les colonnes qui n'ont pas de contenu. « Riot API » et
« Data Dragon » sont d'ailleurs des liens externes qui existent vraiment et
pourraient être branchés tout de suite.

### 4. Deux animations décoratives en boucle infinie

**`components/ranking/Ladder.tsx:202`** — un balayage acide traverse le filet
supérieur du tableau, `2.4s linear infinite`, en permanence. Le commentaire dit
« signale une donnée qui se rafraîchit », mais il tourne aussi quand rien ne se
rafraîchit, y compris en mode démonstration où plus rien ne se rafraîchira
jamais. C'est le seul dégradé du projet, en couleur d'accent, en mouvement
perpétuel : trois plafonds de dose touchés d'un coup.

Piste : le lier à l'état réel de `syncIfStale`, ou le supprimer — le libellé
« Dernier relevé : il y a 3 min » porte déjà l'information, en plus précis.

**`components/site/Ticker.tsx`** — bandeau défilant, `60s linear infinite`.
Le composant est `aria-hidden` et son propre commentaire admet que
l'information est déjà dans le tableau. Un ruban qui duplique une donnée
disponible, en boucle perpétuelle, tombe sous « Endless Pulses and Loops ».
La pause au survol est un bon geste ; elle ne rachète pas la boucle.

C'est le point le plus discutable de l'audit : un ruban boursier est un motif
d'identité crédible pour un « terminal de compétition ». S'il reste, il doit
être revendiqué dans la DA comme motif, avec la valeur du cadran MOTION.

### 5. Trames de fond : trois couches, dont une en couleur d'accent

**Fichier :** `app/layout.tsx:30-38`

Trois calques fixes empilés : `gridlines` (quadrillage de 56 px), `dotfield`
(trame de points) et un dégradé de fermeture. Le quadrillage est nommément le
motif « Background Grid » (R-07) : la façon par défaut de rendre une page plate
« technique ».

Le `dotfield` pose un second problème : ses points sont en
`rgba(233, 255, 31, 0.35)`, soit l'acide — la couleur d'accent du projet —
étalée sur 420 px de fond de page. La DA dit que l'acide signale « la marque,
le gain de LP, la 1re place, la partie en cours ». En trame de fond, il ne
signale rien, et il dilue les quatre endroits où il compte vraiment
(« Excessive Accent Color »).

Les opacités sont très basses (0.028 et 0.4 × 0.35), donc l'effet est ténu.
Mais trois couches décoratives sans justification écrite, c'est de la texture
sans intention. Soit la DA les revendique comme motif d'identité, soit le
quadrillage part et le `dotfield` passe en neutre.

### 6. Deux placeholders inventés dans le formulaire admin

**Fichier :** `components/admin/AddAccountForm.tsx:117,120`

```
placeholder="Voltaic"   // nom d'équipe
placeholder="VLT"       // tag d'équipe
```

`Voltaic` / `VLT` sont des noms plausibles mais fictifs — le motif « Filler
Data in Fields » (R-23). Les autres champs du même formulaire font pourtant
exactement ce qu'il faut : `Pseudo#TAG`, `FR`, `pseudo` disent *quoi mettre*.

Correctif : `Nom de l'équipe` et `TAG`.

### 7. Structure ARIA du tableau incomplète

**Fichiers :** `components/ranking/Ladder.tsx:195`, `LadderRow.tsx:135,213`

`role="table"` contient des `role="row"`, mais aucun descendant ne porte
`role="cell"`. Un lecteur d'écran annonce donc un tableau dont les lignes n'ont
pas de cellules. Il manque aussi un `role="rowgroup"` entre les deux niveaux.

Second point : la ligne de la vue tableau (`:135`) porte `aria-expanded`, celle
de la vue fiche mobile (`:213`) ne le porte pas, alors que les deux ouvrent le
même panneau de détail.

Hors périmètre strict du skill slop, mais c'est le dernier item de sa
checklist (R-03, R-34, C-4).

### 8. Thème sombre imposé, sans bascule

`html { color-scheme: dark }`, `colorScheme: "dark"` dans le viewport, aucun
`@media (prefers-color-scheme: light)`, aucun interrupteur.

R-21 demande que le thème vienne de l'identité, pas de la mode. Ici la
justification existe — « terminal de compétition », et un classement esport est
regardé en soirée — mais elle est dans un commentaire CSS, pas dans un document
de design. C'est la seule raison pour laquelle ce point figure dans la liste :
la décision est bonne, sa trace est au mauvais endroit.

## Ce qui manque en amont

Le skill demande que la palette dérive d'un `DESIGN.md` ou d'une identité
écrite, et que plusieurs choix (mouvement, texture, thème) soient *déclarés*
via des cadrans — RHYTHM, MOTION — avant d'être jugés.

Le projet n'a pas de `DESIGN.md`. La DA existe, elle est même inhabituellement
explicite, mais elle vit dans un commentaire de `globals.css`. Conséquence
directe : quatre des huit constats ci-dessus (2, 4, 5, 8) ne sont pas des
erreurs de goût, ce sont des décisions dont la trace manque. Sans cadran MOTION
déclaré, impossible de dire si trois boucles infinies sont un dépassement ou
l'intention.

Extraire la DA de `globals.css` vers un `DESIGN.md`, en y ajoutant les cadrans
et une ligne sur le pulse « live », rendrait ces quatre points arbitrables au
lieu de discutables.

## Priorités

1. `bg-screen` / `text-screen` — deux bugs visuels, correctif d'une ligne chacun (constat 1)
2. Pied de page : convention `SOON` du header, ou colonnes supprimées (constat 3)
3. Les trois points pulsés décoratifs (constat 2)
4. `Voltaic` / `VLT` (constat 6)
5. `DESIGN.md` avec les cadrans — débloque 2, 4, 5, 8 (constats 4, 5, 8)
6. `role="cell"` + `aria-expanded` cohérent (constat 7)
