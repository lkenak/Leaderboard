import Image from "next/image";
import { runeLabel, runeSrc } from "@/lib/runes";
import { cn } from "@/lib/cn";

/** Icône de rune, d'arbre de runes ou de fragment de statistique — les trois
 *  échelles d'identifiants de `lib/runes.ts` partagent une seule vignette. */
export function RuneIcon({
  id,
  size = 20,
  round = false,
  className,
}: {
  id: number;
  size?: number;
  /** Les runes clés (keystones) sont rondes chez Riot, les mineures carrées. */
  round?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={runeSrc(id)}
      alt={runeLabel(id)}
      title={runeLabel(id)}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", round && "rounded-full", className)}
      style={{ width: size, height: size }}
    />
  );
}
