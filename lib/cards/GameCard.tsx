import { GAME_CARD } from "./layout";
import type { GameCardModel, GameCardPlayer } from "./models";
import { DeltaText, EloCrest, Frame, Label, PositionDelta, Rail, RoleGlyph } from "./primitives";
import { COLOR, FONT, RADIUS, num, ring } from "./tokens";

/**
 * Le compte rendu d'une partie terminée.
 *
 * Une seule carte par partie, même quand plusieurs membres du ladder y ont
 * joué — c'est la raison d'être de `discord_game_posts`, dont la clé ignore
 * le PUUID. Cinq coéquipiers ne doivent pas produire cinq cartes identiques.
 *
 * Pas de splash art : Riot n'en sert aucun en local, et aller le chercher
 * mettrait un `fetch` de 500 Ko dans le chemin de rendu. L'icône carrée du
 * champion et la couleur du résultat suffisent à ce qu'on reconnaisse la
 * partie d'un coup d'œil.
 */

const W = GAME_CARD.width;
const PAD = GAME_CARD.padX;

/** Une ligne par joueur du ladder présent dans la partie. */
const LIGNE = 96;

export function gameCardSize(model: GameCardModel): { width: number; height: number } {
  return { width: W, height: 132 + model.players.length * LIGNE + 54 };
}

function tronquer(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function Joueur({ j, win }: { j: GameCardPlayer; win: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        width: W,
        height: LIGNE,
        padding: `0 ${PAD}px`,
        borderTop: `1px solid ${COLOR.hair}`,
      }}
    >
      <img
        src={j.championIcon}
        width={64}
        height={64}
        style={{ borderRadius: RADIUS.md, boxShadow: ring(COLOR.hair2) }}
        alt=""
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 230, flexShrink: 0 }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: COLOR.ink }}>
          {tronquer(j.name, 16)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {j.role && <RoleGlyph role={j.role} size={18} />}
          <div style={{ display: "flex", ...num(17, 400, COLOR.ink4) }}>
            {tronquer(j.championName, 14)}
          </div>
        </div>
      </div>

      {/* KDA — les morts en brasier, c'est le chiffre qu'on cherche.
          La sous-ligne ne porte que le ratio et les CS : en ajoutant la
          vision, elle passait à la ligne quelle que soit la largeur
          raisonnable de la colonne. Le score de vision reste dans le texte
          alternatif, où il ne coûte rien. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 175, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <div style={{ display: "flex", ...num(28, 600, COLOR.ink) }}>{j.kills}</div>
          <div style={{ display: "flex", ...num(28, 400, COLOR.ink4) }}>/</div>
          <div style={{ display: "flex", ...num(28, 600, COLOR.blaze) }}>{j.deaths}</div>
          <div style={{ display: "flex", ...num(28, 400, COLOR.ink4) }}>/</div>
          <div style={{ display: "flex", ...num(28, 600, COLOR.ink) }}>{j.assists}</div>
        </div>
        <div style={{ display: "flex", ...num(15, 400, COLOR.ink4) }}>
          {`${j.kdaLabel} · ${j.cs} CS`}
        </div>
      </div>

      {/* Variation de LP : le chiffre que tout le monde vient lire. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 150, flexShrink: 0 }}>
        <DeltaText value={j.lpDelta} size={30} suffix=" LP" />
        {j.lpDelta === null && (
          <div style={{ display: "flex", ...num(14, 400, COLOR.ink4) }}>variation inconnue</div>
        )}
      </div>

      {/* Nouveau rang, et place dans le classement. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
        <EloCrest tier={j.tier} division={j.division} size={40} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ display: "flex", ...num(24, 600, COLOR.ink) }}>{j.leaguePoints}</div>
            <div style={{ display: "flex", ...num(15, 400, COLOR.ink4) }}>LP</div>
          </div>
          {j.position !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", ...num(15, 500, win ? COLOR.ink3 : COLOR.ink4) }}>
                {`#${j.position}`}
              </div>
              <PositionDelta delta={j.positionDelta} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GameCard({ model }: { model: GameCardModel }) {
  const { height } = gameCardSize(model);
  const accent = model.win ? COLOR.acid : COLOR.blaze;

  return (
    <Frame width={W} height={height}>
      {/* Bandeau vertical : le résultat se lit avant le texte. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: 10,
          height,
          background: accent,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: W,
          height: 132,
          padding: `0 ${PAD}px 0 ${PAD + 10}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label size={15}>{model.ladderName}</Label>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: accent }}>
            {model.win ? "Victoire" : "Défaite"}
          </div>
          <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>
            {`${model.durationLabel} · ${heure(model.endedAt)}`}
          </div>
        </div>

        {model.players.length > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 14px",
              borderRadius: RADIUS.xs,
              background: COLOR.panel2,
              fontFamily: FONT.mono,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: COLOR.ink3,
            }}
          >
            {`${model.players.length} DU LADDER`}
          </div>
        )}
      </div>

      {model.players.map((j, i) => (
        <Joueur key={i} j={j} win={model.win} />
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          marginTop: "auto",
          padding: `0 ${PAD}px 12px ${PAD + 10}px`,
        }}
      >
        <Label size={14}>
          {model.url ? `soloq/ladder · ${model.url.replace(/^https?:\/\//, "")}` : "soloq/ladder"}
        </Label>
      </div>
      <Rail width="22%" color={accent} />
    </Frame>
  );
}

/** `00:04`, pas `0:4`. */
function heure(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
