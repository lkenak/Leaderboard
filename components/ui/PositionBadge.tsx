import { cn } from "@/lib/cn";

/**
 * Numéro de place. La distinction du podium passe par l'**intensité** de
 * l'accent, pas par trois teintes différentes (or / argent / bronze) : la
 * 1re place est un aplat acide, la 2e un contour acide, la 3e un contour
 * atténué, le reste un simple chiffre. Une seule couleur, quatre crans.
 */
export function PositionBadge({
  position,
  className,
}: {
  position: number;
  className?: string;
}) {
  const base =
    "num inline-flex h-7 min-w-7 items-center justify-center rounded-xs px-1.5 text-num font-semibold tabular-nums";

  if (position === 1)
    return (
      <span className={cn(base, "bg-acid text-acid-ink", className)}>
        {position}
      </span>
    );
  if (position === 2)
    return (
      <span
        className={cn(
          base,
          "text-acid ring-1 ring-acid/70 ring-inset",
          className,
        )}
      >
        {position}
      </span>
    );
  if (position === 3)
    return (
      <span
        className={cn(
          base,
          "text-acid/75 ring-1 ring-acid/30 ring-inset",
          className,
        )}
      >
        {position}
      </span>
    );
  return (
    <span className={cn(base, "text-ink-2", className)}>{position}</span>
  );
}

/** Flèche de variation de place — 3 états, jamais de flèche pour « stable ». */
export function PositionDelta({ delta }: { delta: number }) {
  if (delta === 0)
    return (
      <span className="num text-nano text-ink-4 tabular-nums" title="Place inchangée">
        —
      </span>
    );
  const up = delta > 0;
  return (
    <span
      className={cn(
        "num flex items-center gap-[2px] text-nano font-medium tabular-nums",
        up ? "text-acid/80" : "text-blaze",
      )}
      title={up ? `${delta} place(s) gagnée(s) en 24 h` : `${-delta} place(s) perdue(s) en 24 h`}
    >
      <svg width="7" height="5" viewBox="0 0 7 5" aria-hidden>
        <path
          d={up ? "M3.5 0 7 5H0z" : "M3.5 5 0 0h7z"}
          fill="currentColor"
        />
      </svg>
      {Math.abs(delta)}
    </span>
  );
}
