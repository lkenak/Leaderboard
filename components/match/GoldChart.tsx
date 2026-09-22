import { cn } from "@/lib/cn";
import type { MatchDetail } from "@/lib/types";

/**
 * Courbe d'écart aux golds (équipe 100 moins équipe 200), un point par
 * minute. Même principe que `Sparkline` — SVG inline, pas de librairie de
 * graphique — mais divergente autour de zéro plutôt que normalisée sur son
 * propre min/max, pour ne pas écraser un léger avantage.
 *
 * Coloriée acide/brasier comme `Delta` : positif (équipe bleue en tête) en
 * acide, négatif en brasier — les deux seuls signaux du site pour « devant »
 * et « derrière », plutôt qu'inventer une troisième couleur bleu/rouge que la
 * charte du site réserve à la sélection « low elo ».
 *
 * L'aire au-dessus/au-dessous de zéro est coloriée en clippant deux fois la
 * même géométrie (ligne + fermeture sur la ligne de zéro) par un rectangle
 * couvrant chaque moitié du graphe : pas besoin de recalculer les points
 * d'intersection à chaque changement de signe.
 */
export function GoldChart({
  timeline,
  width = 640,
  height = 160,
  className,
}: {
  timeline: MatchDetail["goldTimeline"];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (timeline.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[0.75rem] text-ink-4"
        style={{ width, height }}
      >
        Courbe indisponible pour cette partie.
      </div>
    );
  }

  const pad = 2;
  const diffs = timeline.map((p) => p.blueGold - p.redGold);
  const maxAbs = Math.max(1, ...diffs.map((d) => Math.abs(d)));
  const zeroY = height / 2;

  const xAt = (i: number) => (i / (timeline.length - 1)) * (width - pad * 2) + pad;
  const yAt = (d: number) => zeroY - (d / maxAbs) * (zeroY - pad);

  const points = diffs.map((d, i) => [xAt(i), yAt(d)] as const);
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${zeroY} L${points[0][0].toFixed(1)} ${zeroY} Z`;

  const last = diffs[diffs.length - 1];
  const leadColor = last >= 0 ? "var(--color-acid)" : "var(--color-blaze)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Écart aux golds, ${last >= 0 ? "avantage" : "retard"} de ${Math.abs(last).toLocaleString("fr-FR")} en fin de partie`}
    >
      <defs>
        <clipPath id="gold-chart-above">
          <rect x="0" y="0" width={width} height={zeroY} />
        </clipPath>
        <clipPath id="gold-chart-below">
          <rect x="0" y={zeroY} width={width} height={height - zeroY} />
        </clipPath>
      </defs>

      <line
        x1="0"
        y1={zeroY}
        x2={width}
        y2={zeroY}
        stroke="var(--color-hair-2)"
        strokeWidth={1}
      />

      <g clipPath="url(#gold-chart-above)">
        <path d={area} fill="var(--color-acid)" opacity={0.16} />
        <path d={line} fill="none" stroke="var(--color-acid)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g clipPath="url(#gold-chart-below)">
        <path d={area} fill="var(--color-blaze)" opacity={0.16} />
        <path d={line} fill="none" stroke="var(--color-blaze)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={3.4} fill={leadColor} />
    </svg>
  );
}
