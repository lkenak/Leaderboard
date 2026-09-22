import Image from "next/image";
import { summonerSpellLabel, summonerSpellSrc } from "@/lib/summoner-spells";
import { cn } from "@/lib/cn";

export function SummonerSpellIcon({
  id,
  size = 20,
  className,
}: {
  id: number;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={summonerSpellSrc(id)}
      alt={summonerSpellLabel(id)}
      title={summonerSpellLabel(id)}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-xs object-cover ring-1 ring-hair", className)}
      style={{ width: size, height: size }}
    />
  );
}
