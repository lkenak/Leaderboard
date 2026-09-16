# Polices

Deux formats du même jeu de polices, pour deux consommateurs :

| Format | Pour qui | Chargé par |
|---|---|---|
| `.woff2` | le navigateur | `@font-face` dans `app/globals.css` |
| `.ttf` | le rendu des cartes Discord | `lib/cards/fonts.ts` |

**Pourquoi les deux.** satori — le moteur derrière `ImageResponse` de `next/og`,
qui dessine les cartes envoyées sur Discord — refuse le WOFF2
(`Unsupported OpenType signature wOF2`). La transformation WOFF2 n'est pas une
simple compression : la table `glyf` est réécrite, et la défaire demande un
décodeur que rien n'embarque ici.

**D'où viennent les .ttf.** Ce sont les `.woff2` de ce dossier décompressés avec
`fontTools.ttLib.woff2.decompress` — pas un second téléchargement. Les métriques
sont donc identiques par construction, et une carte ne peut pas diverger du site
d'un demi-pixel parce que quelqu'un aurait pris une autre version chez la
fonderie.

Seules les graisses réellement utilisées par les cartes sont converties :
General Sans 500/600/700, IBM Plex Mono 400/500/600. Les ajouter toutes
coûterait ~350 Ko pour rien.

Le navigateur ne télécharge jamais les `.ttf` : `globals.css` ne référence que
les `.woff2`.

**Licences** : `general-sans/LICENCE.txt` (ITF Free Font Licence),
`ibm-plex-mono/OFL.txt` (SIL Open Font License 1.1, qui impose que son texte
accompagne toute redistribution).
