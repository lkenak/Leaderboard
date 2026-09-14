import { cn } from "@/lib/cn";

/**
 * Forme récente : une barre par partie, la plus ancienne à gauche, comme une
 * frise. Victoire = acide pleine hauteur, défaite = brasier à mi-hauteur. La
 * différence de *hauteur* double la différence de teinte : la frise reste
 * lisible en niveaux de gris et pour un daltonien.
 */
export function FormStrip({
  form,
  className,
}: {
  /** La partie la plus récente en premier (ordre du modèle). */
  form: boolean[];
  className?: string;
}) {
  const chronological = [...form].reverse();
  const wins = form.filter(Boolean).length;

  return (
    <div
      className={cn("flex items-end gap-[3px]", className)}
      title={`${wins}V ${form.length - wins}D sur les ${form.length} dernières`}
    >
      {chronological.map((win, i) => (
        <span
          key={i}
          className={cn(
            "w-[4px] rounded-[1px]",
            win ? "h-3.5 bg-acid" : "h-2 bg-blaze",
            // La dernière partie est mise en avant d'un cran.
            i === chronological.length - 1
              ? ""
              : win
                ? "opacity-55"
                : "opacity-45",
          )}
        />
      ))}
    </div>
  );
}
