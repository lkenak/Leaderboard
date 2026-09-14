import { cn } from "@/lib/cn";
import { signed } from "@/lib/format";

/**
 * Variation de LP. Le signe est porté par le texte *et* par la couleur ; la
 * valeur nulle reste grise pour ne pas faire de bruit dans une colonne qui doit
 * accrocher l'œil uniquement là où il s'est passé quelque chose.
 */
export function Delta({
  value,
  unit = "LP",
  className,
  size = "md",
}: {
  value: number;
  unit?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const tone =
    value > 0 ? "text-acid" : value < 0 ? "text-blaze" : "text-ink-4";
  const scale =
    size === "lg"
      ? "text-[1.0625rem]"
      : size === "sm"
        ? "text-[0.6875rem]"
        : "text-num";

  return (
    <span
      className={cn(
        "num font-medium whitespace-nowrap tabular-nums",
        scale,
        tone,
        className,
      )}
    >
      {signed(value)}
      {unit ? <span className="ml-1 text-[0.85em] opacity-60">{unit}</span> : null}
    </span>
  );
}
