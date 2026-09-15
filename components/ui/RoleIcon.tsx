import Image from "next/image";
import { roleLabel, roleSrc } from "@/lib/lol";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";

/**
 * Icône de poste. Les SVG de Riot sont monochromes et héritent d'une couleur
 * via `filter` — on les traite comme un glyphe, pas comme une illustration.
 */
export function RoleIcon({
  role,
  size = 16,
  className,
  title = true,
}: {
  role: Role;
  size?: number;
  className?: string;
  title?: boolean;
}) {
  return (
    <Image
      src={roleSrc(role)}
      alt={title ? roleLabel(role) : ""}
      title={title ? roleLabel(role) : undefined}
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0 object-contain select-none opacity-80", className)}
      style={{ width: size, height: size }}
    />
  );
}
