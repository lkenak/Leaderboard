import { cn } from "@/lib/cn";

/**
 * Courbe de LP en SVG inline — pas de librairie de graphiques pour tracer
 * 27 points. Normalisée sur son propre min/max : ce qui compte dans une
 * cellule de 88 px, c'est la forme du trajet, pas la valeur absolue.
 */
export function Sparkline({
  values,
  width = 88,
  height = 26,
  className,
  strokeWidth = 1.5,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = strokeWidth;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width - pad} ${height} L${pad} ${height} Z`;

  const rising = values[values.length - 1] >= values[0];
  const stroke = rising ? "var(--color-acid)" : "var(--color-blaze)";
  const gradId = `spark-${rising ? "up" : "down"}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={strokeWidth + 0.6}
        fill={stroke}
      />
    </svg>
  );
}
