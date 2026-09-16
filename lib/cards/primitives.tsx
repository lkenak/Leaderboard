import type { CSSProperties, ReactNode } from "react";
import { crestSrc, roleSrc } from "@/lib/lol";
import type { Role, Tier } from "@/lib/types";
import { asset } from "./assets";
import { COLOR, FONT, RADIUS, TIER_COLOR, caps, label, num, ring } from "./tokens";

/**
 * Les briques communes aux cartes.
 *
 * Trois contraintes de satori dictent la forme de tout ce fichier :
 *  - **flexbox seulement** : pas de CSS grid, et tout conteneur à plusieurs
 *    enfants doit porter un `display: flex` explicite ;
 *  - **pas de `clip-path`, pas de filtre SVG, pas de `mix-blend-mode`** : le
 *    `skewbox` du site est refait en `transform: skewX()`, et le `grain` est
 *    simplement abandonné sur les cartes ;
 *  - **aucun glyphe hors des polices fournies** : un caractère manquant fait
 *    partir satori chercher une image sur le CDN twemoji, dans le chemin de
 *    rendu et sans délai de garde. D'où les triangles dessinés en SVG plutôt
 *    qu'un caractère « ▲ », et zéro emoji.
 */

/* ── Support ──────────────────────────────────────────────────────────────── */

/** Le fond commun : noir bleuté + la grille technique de `.gridlines`. */
export function Frame({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        background: COLOR.void,
        // `.gridlines` : deux dégradés linéaires tuilés. Validé sous satori,
        // contrairement au `radial-gradient` de `.dotfield`.
        backgroundImage: `linear-gradient(${COLOR.hair} 1px, transparent 1px), linear-gradient(90deg, ${COLOR.hair} 1px, transparent 1px)`,
        backgroundSize: "96px 96px",
        fontFamily: FONT.sans,
        color: COLOR.ink,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Le rail du `Podium` : la signature de bas de carte.
 *
 * Acide par défaut, mais il prend la couleur de l'état quand la carte en a un
 * — sur une PP annulée, tout le reste passe au brasier et un rail resté acide
 * détonnait.
 */
export function Rail({
  width = "38%",
  color = COLOR.acid,
}: {
  width?: number | string;
  color?: string;
}) {
  return <div style={{ display: "flex", width, height: 4, background: color }} />;
}

/* ── Texte ────────────────────────────────────────────────────────────────── */

export function Label({
  children,
  size = 20,
  color = COLOR.ink3,
}: {
  children: string;
  size?: number;
  color?: string;
}) {
  return <div style={{ display: "flex", ...label(size, color) }}>{caps(children)}</div>;
}

export function Num({
  children,
  size = 26,
  weight = 600,
  color = COLOR.ink,
}: {
  children: ReactNode;
  size?: number;
  weight?: 400 | 500 | 600;
  color?: string;
}) {
  return <div style={{ display: "flex", ...num(size, weight, color) }}>{children}</div>;
}

/* ── Le parallélogramme de la marque ──────────────────────────────────────── */

/**
 * `.skewbox` du site. Le `clip-path` n'existe pas sous satori, mais
 * `transform: skewX(-11deg)` rend exactement la même forme — à condition de
 * contre-incliner le texte, sinon il penche aussi.
 */
export function SkewChip({
  children,
  background = COLOR.acid,
  color = COLOR.acidInk,
  size = 20,
}: {
  children: string;
  background?: string;
  color?: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background,
        transform: "skewX(-11deg)",
        padding: "6px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          transform: "skewX(11deg)",
          fontFamily: FONT.mono,
          fontSize: size,
          fontWeight: 600,
          letterSpacing: size * 0.1,
          color,
        }}
      >
        {caps(children)}
      </div>
    </div>
  );
}

/* ── Images ───────────────────────────────────────────────────────────────── */

export function Crest({ tier, size = 40 }: { tier: Tier | "UNRANKED"; size?: number }) {
  return <img src={asset(crestSrc(tier))} width={size} height={size} alt="" />;
}

export function RoleGlyph({ role, size = 26 }: { role: Role; size?: number }) {
  return <img src={asset(roleSrc(role))} width={size} height={size} alt="" />;
}

/* ── Position et variation ────────────────────────────────────────────────── */

/**
 * Triangle de variation, en SVG data-URI.
 *
 * Pas de caractère « ▲ » : ce glyphe n'est ni dans General Sans ni dans IBM
 * Plex Mono, et son absence déclencherait un appel réseau (voir l'en-tête).
 */
function triangle(color: string, up: boolean): string {
  const d = up ? "M5 0 L10 7 L0 7 Z" : "M5 7 L0 0 L10 0 Z";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="7" viewBox="0 0 10 7"><path d="${d}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Variation de place : montée acide, descente brasier, tiret si inconnue. */
export function PositionDelta({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return <div style={{ display: "flex", ...num(18, 500, COLOR.ink4) }}>—</div>;
  }
  const up = delta > 0;
  const color = up ? COLOR.acid : COLOR.blaze;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <img src={triangle(color, up)} width={10} height={7} alt="" />
      <div style={{ display: "flex", ...num(18, 500, color) }}>{Math.abs(delta)}</div>
    </div>
  );
}

/**
 * Variation de LP. `null` n'est pas zéro : le delta n'est connu que lorsque
 * exactement une partie sépare deux relevés (`lib/riot/sync.ts::fillLpDeltas`).
 * Le site affiche « — LP » dans ce cas, la carte fait pareil.
 */
export function DeltaText({
  value,
  size = 26,
  suffix = "",
}: {
  value: number | null;
  size?: number;
  suffix?: string;
}) {
  if (value === null) {
    return <div style={{ display: "flex", ...num(size, 600, COLOR.ink4) }}>{`—${suffix}`}</div>;
  }
  const color = value > 0 ? COLOR.acid : value < 0 ? COLOR.blaze : COLOR.ink3;
  const signe = value > 0 ? "+" : value < 0 ? "−" : "±";
  return (
    <div style={{ display: "flex", ...num(size, 600, color) }}>
      {`${signe}${Math.abs(value)}${suffix}`}
    </div>
  );
}

/** Pastille de rang : aplat acide pour la 1re place, contour pour le podium. */
export function PositionChip({ position }: { position: number }) {
  const base: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 36,
    borderRadius: RADIUS.xs,
    ...num(26, 600, COLOR.ink2),
  };
  const styles: Record<number, CSSProperties> = {
    1: { background: COLOR.acid, color: COLOR.acidInk },
    2: { boxShadow: ring(COLOR.acid, 1.5), color: COLOR.acid },
    3: { boxShadow: ring("rgba(233, 255, 31, 0.3)"), color: "rgba(233, 255, 31, 0.75)" },
  };
  return <div style={{ ...base, ...styles[position] }}>{position}</div>;
}

/* ── Séries et taux ───────────────────────────────────────────────────────── */

/**
 * `FormStrip` : la plus récente à droite, à pleine opacité, les précédentes
 * en retrait. Victoire haute et acide, défaite basse et brasier — la forme se
 * lit avant la couleur, ce qui la garde lisible en cas de daltonisme.
 */
export function FormBars({ form, max = 7 }: { form: boolean[]; max?: number }) {
  const shown = form.slice(-max);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 26 }}>
      {shown.map((win, i) => {
        const fromEnd = shown.length - 1 - i;
        const opacity = fromEnd === 0 ? 1 : fromEnd === 1 ? 0.55 : 0.45;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              width: 7,
              height: win ? 26 : 14,
              background: win ? COLOR.acid : COLOR.blaze,
              opacity,
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}

/** Barre de winrate : part acide puis part brasier, jamais un pourcentage seul. */
export function WinBar({
  wins,
  losses,
  width = 130,
}: {
  wins: number;
  losses: number;
  width?: number;
}) {
  const total = wins + losses;
  const part = total === 0 ? 0 : Math.round((wins / total) * (width - 3));
  return (
    <div style={{ display: "flex", gap: 3, width, height: 7 }}>
      <div style={{ display: "flex", width: part, background: "rgba(233, 255, 31, 0.85)" }} />
      <div
        style={{
          display: "flex",
          width: width - 3 - part,
          background: "rgba(255, 45, 85, 0.55)",
        }}
      />
    </div>
  );
}

/** Couleur de palier, pour un texte qui doit reprendre la teinte du crest. */
export function tierColor(tier: Tier | "UNRANKED"): string {
  return TIER_COLOR[tier];
}
