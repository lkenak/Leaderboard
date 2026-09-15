import { cn } from "@/lib/cn";

/**
 * Témoin de direct. C'est la seule boucle d'animation du projet, et elle n'est
 * tolérée que sous les trois conditions de DESIGN.md § 6 : elle marque un état
 * réellement en cours, il n'y en a qu'un par contexte, et le composant n'est
 * pas monté quand l'état s'éteint.
 *
 * Donc : appelé uniquement là où quelque chose est en train de se passer — un
 * joueur en partie, un compteur de parties en cours non nul. Un point à côté
 * d'un horodatage ou d'un libellé de filtre ne marque aucun direct ; pour ces
 * cas, un disque plein statique suffit et ne réclame pas l'œil.
 */
export function LiveDot({
  className,
  tone = "acid",
}: {
  className?: string;
  /** `acid` = partie en cours · `blaze` = chaîne en direct (DESIGN.md § 3). */
  tone?: "acid" | "blaze";
}) {
  return (
    <span className={cn("relative flex size-[6px] shrink-0", className)}>
      <span
        className={cn(
          "absolute inset-0 animate-pulse-dot rounded-full",
          tone === "acid" ? "bg-acid" : "bg-blaze",
        )}
      />
    </span>
  );
}
