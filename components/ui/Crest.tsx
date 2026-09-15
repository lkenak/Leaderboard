import Image from "next/image";
import { crestSrc } from "@/lib/lol";
import { cn } from "@/lib/cn";
import type { Tier } from "@/lib/types";

/**
 * Emblème de palier officiel (mini-crest Riot, SVG). Il porte seul la teinte du
 * palier — le texte à côté reste dans la rampe de gris, pour éviter d'avoir dix
 * couleurs de texte dans un tableau.
 *
 * Seuls quatre des onze crests sont carrés : bronze et silver sont en 18x12,
 * gold en 17x13, iron en 17x12, master / grandmaster / challenger en 17x15. La
 * boîte reste carrée — c'est ce qui aligne les lignes du tableau — mais
 * `object-contain` laisse le dessin à ses proportions dedans au lieu de
 * l'étirer.
 */
export function Crest({
  tier,
  size = 26,
  className,
}: {
  tier: Tier;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={crestSrc(tier)}
      alt=""
      width={size}
      height={size}
      aria-hidden
      unoptimized
      className={cn("shrink-0 object-contain select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}
