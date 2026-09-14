import { cn } from "@/lib/cn";

/**
 * Point pulsé. Une seule animation infinie sur la page : elle est réservée aux
 * états réellement vivants (joueur en partie, relevé en cours), jamais à de la
 * décoration.
 */
export function LiveDot({
  className,
  tone = "acid",
}: {
  className?: string;
  tone?: "acid" | "blaze" | "ink";
}) {
  const bg =
    tone === "acid" ? "bg-acid" : tone === "blaze" ? "bg-blaze" : "bg-ink-3";
  return (
    <span className={cn("relative flex size-[6px] shrink-0", className)}>
      <span className={cn("absolute inset-0 animate-pulse-dot rounded-full", bg)} />
    </span>
  );
}
