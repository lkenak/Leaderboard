import { NextResponse, type NextRequest } from "next/server";
import { COLOR, FONT, TIER_COLOR, label, num } from "@/lib/cards/tokens";
import {
  Crest,
  DeltaText,
  FormBars,
  Frame,
  Label,
  PositionChip,
  PositionDelta,
  Rail,
  RoleGlyph,
  SkewChip,
  WinBar,
} from "@/lib/cards/primitives";
import { refuseNonAutorise } from "@/lib/cards/internal-auth";
import { renderCard } from "@/lib/cards/render";
import { ROLES, TIERS } from "@/lib/types";

/**
 * Planche d'essai du rendu de cartes.
 *
 * Elle n'affiche aucune donnée réelle : son seul rôle est de prouver, sur la
 * machine qui rendra les vraies cartes, que chaque élément de la direction
 * artistique survit à satori. Les quatre choses qu'on vient vérifier à l'œil :
 *
 *  1. les 11 crests et les 5 postes (des SVG, rendus tels quels) ;
 *  2. le parallélogramme `skewbox`, refait en `transform: skewX()` faute de
 *     `clip-path` ;
 *  3. la grille de fond, les dégradés des barres, les ombres internes ;
 *  4. les accents et la ponctuation française — « É », « ’ », « · », « — » :
 *     un caractère absent des polices ferait partir satori sur le CDN
 *     twemoji, en plein chemin de rendu.
 *
 * À ouvrir avec `?format=png` dans un navigateur. Protégée comme
 * `/api/refresh`, et de toute façon injoignable de l'extérieur (le Caddyfile
 * répond 404 sur `/api/internal/*`).
 */

export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 700;

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Label size={16}>{titre}</Label>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>{children}</div>
    </div>
  );
}

function Demo() {
  return (
    <Frame width={WIDTH} height={HEIGHT}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "40px 40px 0 40px",
          gap: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: COLOR.ink }}>
              Planche d’essai
            </div>
            <Label size={18}>Rendu des cartes · vérification de la direction artistique</Label>
          </div>
          <SkewChip>Démo</SkewChip>
        </div>

        <Section titre="Paliers">
          {[...TIERS, "UNRANKED" as const].map((tier) => (
            <div
              key={tier}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            >
              <Crest tier={tier} size={44} />
              <div style={{ display: "flex", ...num(12, 500, TIER_COLOR[tier]) }}>
                {tier.slice(0, 4)}
              </div>
            </div>
          ))}
        </Section>

        <Section titre="Postes">
          {ROLES.map((role) => (
            <RoleGlyph key={role} role={role} size={30} />
          ))}
        </Section>

        <Section titre="Signaux · variations · séries">
          <PositionChip position={1} />
          <PositionChip position={2} />
          <PositionChip position={3} />
          <PositionChip position={9} />
          <PositionDelta delta={3} />
          <PositionDelta delta={-2} />
          <PositionDelta delta={null} />
          <DeltaText value={24} suffix=" LP" />
          <DeltaText value={-17} suffix=" LP" />
          <DeltaText value={null} suffix=" LP" />
          <FormBars form={[true, false, true, true, true, false, true]} />
          <WinBar wins={58} losses={42} />
        </Section>

        <Section titre="Typographie">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: COLOR.ink }}>
              Été · Où l’on démarre à 21 h 30 — « Fearless Draft »
            </div>
            <div style={{ display: "flex", ...num(26, 600, COLOR.ink) }}>
              0123456789 · ±2 714 LP · 58 % · 12/3/9
            </div>
            <div style={{ display: "flex", ...label(18, COLOR.ink3) }}>
              {"RELEVÉ DU 16/09 À 14:32 · SPLIT 3"}
            </div>
            <div style={{ display: "flex", fontFamily: FONT.mono, fontSize: 18, color: COLOR.ink4 }}>
              Repli ink-4 · filets hair/hair-2/hair-3
            </div>
          </div>
        </Section>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "0 40px 28px 40px",
        }}
      >
        <Label size={16}>SOLOQ/LADDER · planche d’essai</Label>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", width: 60, height: 10, background: COLOR.acid }} />
          <div style={{ display: "flex", width: 60, height: 10, background: COLOR.blaze }} />
          <div style={{ display: "flex", width: 60, height: 10, background: COLOR.sky }} />
          <div style={{ display: "flex", width: 60, height: 10, background: COLOR.gold }} />
        </div>
      </div>
      <Rail />
    </Frame>
  );
}

export async function GET(request: NextRequest) {
  const refus = refuseNonAutorise(request);
  if (refus) return refus;

  const png = await renderCard(<Demo />, { width: WIDTH, height: HEIGHT });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
