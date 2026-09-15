"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { crestSrc } from "@/lib/lol";
import { useClock } from "@/lib/clock";

/**
 * Coupe apex : les LP exigés par la dernière place de Challenger et de Grand
 * Maître. C'est l'information que regarde en premier un joueur de haut de
 * ladder, donc elle est en en-tête et pas enterrée dans une infobulle.
 */
export function CutoffWidget({
  challenger,
  grandmaster,
  className,
}: {
  challenger: number;
  grandmaster: number;
  /** Permet de passer en pleine largeur quand le widget est empilé en colonne. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3.5 rounded-md border border-hair bg-panel/60 px-4 py-2.5 whitespace-nowrap transition-colors duration-300 hover:border-hair-2",
        className,
      )}
    >
      <span
        className="label cursor-help"
        title="LP demandés en ce moment par la dernière place de Challenger et de Grand Maître sur EUW"
      >
        Coupe
      </span>
      <span className="h-7 w-px bg-hair" />
      <CutoffValue tier="challenger" value={challenger} label="Dernier Challenger" />
      <CutoffValue tier="grandmaster" value={grandmaster} label="Dernier Grand Maître" />
    </div>
  );
}

function CutoffValue({
  tier,
  value,
  label,
}: {
  tier: string;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5" title={label}>
      <Image
        src={crestSrc(tier as never)}
        alt=""
        width={20}
        height={20}
        unoptimized
        aria-hidden
        className="size-5 object-contain"
      />
      <span className="num text-[1.125rem] leading-none font-semibold text-ink tabular-nums">
        {value}
      </span>
      <span className="num text-[0.625rem] font-medium text-ink-4">LP</span>
    </span>
  );
}

/**
 * Compte à rebours de fin de split. Le rendu serveur utilise l'horodatage qu'il
 * a produit ; l'horloge partagée prend le relais à l'hydratation, donc pas
 * d'écart entre les deux.
 */
export function Countdown({
  endsAt,
  serverNow,
  className,
}: {
  endsAt: number;
  serverNow: number;
  /** Permet de passer en pleine largeur quand le widget est empilé en colonne. */
  className?: string;
}) {
  const now = useClock(1000, serverNow);

  const remaining = Math.max(0, endsAt - now);
  const sec = Math.floor(remaining / 1000);
  const parts = [
    { value: Math.floor(sec / 86400), unit: "j" },
    { value: Math.floor(sec / 3600) % 24, unit: "h" },
    { value: Math.floor(sec / 60) % 60, unit: "m" },
    { value: sec % 60, unit: "s" },
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3.5 rounded-md border border-hair bg-panel/60 px-4 py-2.5 whitespace-nowrap transition-colors duration-300 hover:border-hair-2",
        className,
      )}
    >
      <span className="label leading-[1.25]">
        Fin du
        <br />
        split dans
      </span>
      <span className="h-7 w-px bg-hair" />
      <span className="num flex items-baseline gap-1.5 tabular-nums">
        {parts.map((p, i) => (
          <span key={p.unit} className="flex items-baseline">
            {i > 0 && (
              <span className="mr-1.5 text-[1rem] leading-none font-light text-ink-4">
                :
              </span>
            )}
            <span className="text-[1.375rem] leading-none font-semibold text-ink">
              {String(p.value).padStart(2, "0")}
            </span>
            <span className="ml-px text-[0.625rem] font-medium text-ink-4">
              {p.unit}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
