import Image from "next/image";
import { championSrc } from "@/lib/lol";
import { cn } from "@/lib/cn";

export function ChampionIcon({
  championId,
  championName,
  size = 24,
  className,
}: {
  championId: string;
  championName?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={championSrc(championId)}
      alt={championName ?? championId}
      title={championName ?? championId}
      width={size}
      height={size}
      // Pas de `quality` explicite : Next 16 exige de déclarer chaque valeur
      // dans `images.qualities`, et à 24 px la qualité par défaut suffit.
      className={cn(
        "shrink-0 rounded-xs bg-panel-3 object-cover ring-1 ring-hair",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
