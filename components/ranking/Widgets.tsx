"use client";

import { useClock } from "@/lib/clock";

/**
 * Compte à rebours de fin de split. Le rendu serveur utilise l'horodatage qu'il
 * a produit ; l'horloge partagée prend le relais à l'hydratation, donc pas
 * d'écart entre les deux.
 */
export function Countdown({
  endsAt,
  serverNow,
}: {
  endsAt: number;
  serverNow: number;
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
    <div className="inline-flex items-center gap-3.5 rounded-md border border-hair bg-panel/60 px-4 py-2.5 whitespace-nowrap transition-colors duration-300 hover:border-hair-2">
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
