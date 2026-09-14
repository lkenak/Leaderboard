/**
 * Horodatage du relevé, arrondi à la minute.
 *
 * L'arrondi n'est pas cosmétique : le rendu serveur et l'hydratation doivent
 * partir exactement de la même valeur, or plusieurs centaines de millisecondes
 * séparent l'un de l'autre. Tout ce qui est relatif au temps sur la page part
 * de cette valeur, puis l'horloge client (`lib/clock.ts`) prend le relais.
 *
 * Fonction volontairement isolée du corps des composants : la lecture de
 * l'heure est un effet de bord, elle n'a pas sa place dans un rendu — sauf
 * précisément ici, où la page est déclarée dynamique et où chaque requête doit
 * produire un relevé neuf.
 */
export function reportedNow(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}
