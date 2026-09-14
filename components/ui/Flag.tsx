import Image from "next/image";
import { cn } from "@/lib/cn";

const NAMES: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  ES: "Espagne",
  DE: "Allemagne",
  PL: "Pologne",
  GR: "Grèce",
  RU: "Russie",
  KR: "Corée du Sud",
  PT: "Portugal",
  IT: "Italie",
  NL: "Pays-Bas",
  CH: "Suisse",
  GB: "Royaume-Uni",
  SE: "Suède",
  DK: "Danemark",
};

/**
 * Drapeau en ratio 3:2. Le filet intérieur clair évite qu'un drapeau blanc
 * (Suisse, Danemark) disparaisse sur fond sombre.
 */
export function Flag({
  code,
  width = 15,
  className,
}: {
  code: string;
  width?: number;
  className?: string;
}) {
  const cc = code.toLowerCase();
  const height = Math.round((width / 3) * 2);
  return (
    <Image
      src={`/lol/flags/${cc}.png`}
      alt={NAMES[code.toUpperCase()] ?? code}
      title={NAMES[code.toUpperCase()] ?? code}
      width={width}
      height={height}
      className={cn("shrink-0 object-cover", className)}
      style={{
        width,
        height,
        borderRadius: 2,
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.45)",
      }}
    />
  );
}

export function countryName(code: string): string {
  return NAMES[code.toUpperCase()] ?? code;
}
