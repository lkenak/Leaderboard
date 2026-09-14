import { cn } from "@/lib/cn";

/**
 * Double chevron d'en-tête de colonne : l'un des deux s'allume selon le sens.
 * Le caret occupe toujours la même place, donc l'en-tête ne bouge pas au clic.
 */
export function SortCaret({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <span className="ml-1 inline-flex flex-col items-center gap-[1px]" aria-hidden>
      <svg width="6" height="4" viewBox="0 0 6 4">
        <path
          d="M3 0 6 4H0z"
          className={cn(
            active && dir === "asc" ? "fill-acid" : "fill-ink-4",
          )}
        />
      </svg>
      <svg width="6" height="4" viewBox="0 0 6 4">
        <path
          d="M3 4 0 0h6z"
          className={cn(
            active && dir === "desc" ? "fill-acid" : "fill-ink-4",
          )}
        />
      </svg>
    </span>
  );
}
