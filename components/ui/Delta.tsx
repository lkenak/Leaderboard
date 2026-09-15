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
  unknown = "absent",
  unknownTitle,
}: {
  /** `null` = la variation n'est pas connue, ce n'est pas la même chose que 0. */
  value: number | null;
  unit?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * Deux absences différentes, deux glyphes (DESIGN.md § 9) :
   *
   * - `absent` — il ne s'est rien passé, il n'y a rien à mesurer : `—`.
   * - `pending` — il s'est passé quelque chose, mais la mesure n'est pas encore
   *   possible : `···`. C'est le cas d'un compte qui a joué dans les dernières
   *   24 h alors qu'un seul relevé de LP existe : un gain de LP est un
   *   différentiel, il faut deux relevés encadrant la partie.
   *
   * Les deux affichaient `—`, donc « aucune partie » et « pas encore
   * mesurable » étaient indistinguables, et la seule explication vivait dans
   * une infobulle.
   */
  unknown?: "absent" | "pending";
  unknownTitle?: string;
}) {
  if (value === null) {
    const pending = unknown === "pending";
    return (
      <span
        className={cn("num text-num text-ink-4", className)}
        title={
          unknownTitle ??
          (pending
            ? "Pas encore mesurable : un gain de LP se calcule entre deux relevés, et le suivi vient de commencer"
            : "Aucune variation à afficher")
        }
      >
        {pending ? "···" : "—"}
      </span>
    );
  }

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
