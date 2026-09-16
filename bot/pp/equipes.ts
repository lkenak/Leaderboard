import type { JoueurPp } from "./joueurs";

/**
 * Répartition en deux équipes équilibrées.
 *
 * L'algorithme est celui de « Organisation PP » : tirage en serpentin glouton
 * — on place les joueurs du plus fort au plus faible, chacun dans l'équipe la
 * plus faible, avec une pénalité quand le poste est déjà pris. Il tient en
 * vingt lignes et donne de bons résultats ; il n'y avait aucune raison de le
 * remplacer.
 *
 * Deux choses changent.
 *
 * **La force vient des LP absolus mesurés**, plus d'un score de palier
 * déclaré. L'ancien calculait `palier × 5 + division`, une échelle à 54
 * crans où Émeraude IV et Émeraude I étaient à trois points l'un de l'autre.
 * `absoluteLp` est continu et réel : deux Émeraude II séparés de 60 LP ne
 * s'équilibrent pas comme deux joueurs identiques. La pénalité de poste est
 * donc réexprimée dans la même unité — en LP, pas en crans de palier.
 *
 * **Le tirage est aléatoire à force égale.** Malgré son libellé « Tirer les
 * équipes », l'ancien était parfaitement déterministe : même liste, mêmes
 * équipes, indéfiniment. Relancer ne servait à rien, ce que personne ne
 * pouvait deviner. Le mélange préalable ne casse pas l'équilibrage — il ne
 * départage que les ex æquo.
 */

/**
 * Coût d'une collision de poste, en LP.
 *
 * ~400 LP, c'est environ un palier et demi : assez pour qu'on préfère
 * déséquilibrer légèrement plutôt que d'aligner deux junglers, pas assez pour
 * qu'on sacrifie l'équilibre à une contrainte de confort. Le poste secondaire
 * coûte le quart, comme dans l'original.
 */
const PENALITE_POSTE = 400;
const PENALITE_SECONDAIRE = PENALITE_POSTE / 4;

function penalite(joueur: JoueurPp, equipe: JoueurPp[]): number {
  const postes = equipe.map((m) => m.mainRole).filter(Boolean);
  let p = 0;
  if (joueur.mainRole && postes.includes(joueur.mainRole)) p += PENALITE_POSTE;
  if (joueur.secondaryRole && postes.includes(joueur.secondaryRole)) p += PENALITE_SECONDAIRE;
  return p;
}

function melanger<T>(liste: T[]): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Tirage {
  equipes: [JoueurPp[], JoueurPp[]];
  /** Écart de force entre les deux équipes, en LP — l'honnêteté du tirage. */
  ecartLp: number;
}

export function tirerEquipes(joueurs: JoueurPp[]): Tirage {
  // Mélange d'abord, tri ensuite : le tri est stable, donc les ex æquo
  // gardent l'ordre aléatoire au lieu de l'ordre d'inscription.
  const tries = melanger(joueurs).sort((a, b) => b.absoluteLp - a.absoluteLp);

  const equipes: Array<{ joueurs: JoueurPp[]; force: number }> = [
    { joueurs: [], force: 0 },
    { joueurs: [], force: 0 },
  ];
  const taille = Math.ceil(joueurs.length / 2);

  for (const joueur of tries) {
    const candidates = equipes.filter((e) => e.joueurs.length < taille);
    candidates.sort(
      (a, b) =>
        a.force + penalite(joueur, a.joueurs) - (b.force + penalite(joueur, b.joueurs)),
    );
    candidates[0].joueurs.push(joueur);
    candidates[0].force += joueur.absoluteLp;
  }

  return {
    equipes: [equipes[0].joueurs, equipes[1].joueurs],
    ecartLp: Math.abs(equipes[0].force - equipes[1].force),
  };
}
