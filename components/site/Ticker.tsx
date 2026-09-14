import { cn } from "@/lib/cn";
import { signed } from "@/lib/format";
import type { RankingEntry } from "@/lib/types";

/**
 * Bandeau des mouvements du jour, à la manière d'un ruban boursier. Deux copies
 * de la même liste défilent en boucle : la translation de -50 % fait revenir la
 * seconde copie exactement là où commençait la première, sans saut.
 *
 * Purement décoratif au sens de l'accessibilité — la même information est dans
 * le tableau —, donc `aria-hidden` et pas de rôle marquee.
 */
export function Ticker({ entries }: { entries: RankingEntry[] }) {
  const movers = entries
    .filter((e) => e.session.games > 0)
    .sort((a, b) => Math.abs(b.session.lp) - Math.abs(a.session.lp))
    .slice(0, 14);

  if (movers.length === 0) return null;
  const loop = [...movers, ...movers];

  return (
    <div
      aria-hidden
      className="fade-x relative overflow-hidden border-y border-hair bg-panel/40 py-2.5"
    >
      <div className="animate-ticker flex w-max gap-8 hover:[animation-play-state:paused]">
        {loop.map((entry, i) => (
          <span
            key={`${entry.player.puuid}-${i}`}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap"
          >
            <span className="text-[0.75rem] font-medium text-ink-2">
              {entry.player.gameName}
            </span>
            <span
              className={cn(
                "num text-[0.75rem] font-medium tabular-nums",
                entry.session.lp > 0
                  ? "text-acid"
                  : entry.session.lp < 0
                    ? "text-blaze"
                    : "text-ink-4",
              )}
            >
              {signed(entry.session.lp)} LP
            </span>
            <span className="num text-[0.6875rem] text-ink-4">
              {entry.session.wins}V·{entry.session.losses}D
            </span>
            <span className="text-ink-4">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
