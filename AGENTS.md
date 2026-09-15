<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Travail sur l'UI

Avant toute modification d'un composant, d'une feuille de style ou d'une page :

1. lire `DESIGN.md` — c'est la référence de la direction artistique. Les trois
   signaux chromatiques et leur rôle exclusif, les plafonds de dose, et les
   trois cadrans déclarés (RHYTHM 2, **MOTION 1**, DENSITY 3). Un écart à un
   cadran est un défaut, pas un goût ;
2. lire `.claude/skills/antislop-ui/SKILL.md` et passer sa checklist finale.

Les deux contraintes les plus faciles à enfreindre sans le voir :

- **Aucune boucle d'animation** en dehors du témoin de direct (`LiveDot`), qui
  exige un état réellement en cours.
- **Aucune information affichée deux fois.** C'est un classement : ce qui est
  répété fait scroller avant la première réponse.

`docs/audit-slop-ui.md` garde la trace des défauts déjà corrigés et de ce qui
reste ouvert — le relire évite de réintroduire un motif déjà retiré.
