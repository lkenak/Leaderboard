import Image from "next/image";
import { itemLabel, itemSrc } from "@/lib/items";
import { cn } from "@/lib/cn";

/**
 * Icône d'objet. `id === 0` : emplacement vide — Data Dragon n'a pas de
 * vignette pour « rien », donc on dessine juste le cadre.
 */
export function ItemIcon({
  id,
  size = 22,
  className,
}: {
  id: number;
  size?: number;
  className?: string;
}) {
  if (id === 0) {
    return (
      <div
        className={cn("shrink-0 rounded-xs bg-panel-3 ring-1 ring-hair", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Image
      src={itemSrc(id)}
      alt={itemLabel(id)}
      title={itemLabel(id)}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-xs bg-panel-3 object-cover ring-1 ring-hair", className)}
      style={{ width: size, height: size }}
    />
  );
}
