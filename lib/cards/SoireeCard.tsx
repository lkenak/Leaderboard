import { GAME_CARD } from "./layout";
import type { SoireeCardModel, SoireeJoueurModel } from "./models";
import { DeltaText, EloCrest, Frame, Label, PositionDelta, Rail } from "./primitives";
import { COLOR, RADIUS, num, ring } from "./tokens";

/**
 * Le résumé d'une soirée : une carte pour toute une série de parties.
 *
 * Elle existe pour un salon qui ne veut pas d'une carte par partie. Le compte
 * rendu individuel (`GameCard`) raconte *une* partie en détail — KDA, CS,
 * durée ; celle-ci raconte une soirée, donc elle ne garde que ce qui a un sens
 * cumulé : le bilan, la variation nette, le rang atteint et la place gagnée
 * ou perdue. Un KDA moyenné sur huit parties ne dit rien à personne.
 *
 * L'ordre est celui de la soirée, pas celui du ladder : la meilleure
 * progression d'abord. C'est la seule chose que ce salon n'a pas déjà vue
 * ailleurs — le classement, lui, est à un `/classement` près.
 */

const W = GAME_CARD.width;
const PAD = GAME_CARD.padX;

const EN_TETE = 148;
const LIGNE = 84;
const PIED = 54;

export function soireeCardSize(model: SoireeCardModel): { width: number; height: number } {
  return { width: W, height: EN_TETE + model.joueurs.length * LIGNE + PIED };
}

function tronquer(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function Joueur({ j, rang }: { j: SoireeJoueurModel; rang: number }) {
  /* Le ton de la ligne suit le résultat de la soirée, pas celui du ladder :
     une soirée négative reste une soirée négative même pour le premier. */
  const positif = j.lpNet !== null && j.lpNet > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: W,
        height: LIGNE,
        padding: `0 ${PAD}px`,
        borderTop: `1px solid ${COLOR.hair}`,
      }}
    >
      {/* Le rang dans la soirée, discret : il ordonne la lecture sans
          prétendre être une place au classement. */}
      <div style={{ display: "flex", width: 26, ...num(20, 600, COLOR.ink4) }}>{rang}</div>

      <img
        src={j.championIcon}
        width={52}
        height={52}
        style={{ borderRadius: RADIUS.md, boxShadow: ring(COLOR.hair2) }}
        alt=""
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 250, flexShrink: 0 }}>
        <div style={{ display: "flex", fontSize: 25, fontWeight: 600, color: COLOR.ink }}>
          {tronquer(j.name, 17)}
        </div>
        <div style={{ display: "flex", ...num(16, 400, COLOR.ink4) }}>
          {tronquer(j.championName, 16)}
        </div>
      </div>

      {/* Le bilan. Les victoires portent la couleur, les défaites restent
          sourdes : c'est la silhouette « 5V 2D » qu'on lit, pas deux nombres. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, width: 130, flexShrink: 0 }}>
        <div style={{ display: "flex", ...num(28, 600, COLOR.acid) }}>{j.wins}</div>
        <div style={{ display: "flex", ...num(19, 400, COLOR.ink4) }}>V</div>
        <div style={{ display: "flex", ...num(28, 600, COLOR.ink2) }}>{j.losses}</div>
        <div style={{ display: "flex", ...num(19, 400, COLOR.ink4) }}>D</div>
      </div>

      {/* La variation nette : le chiffre de la soirée. L'astérisque dit que
          des parties manquent à l'appel, sans quoi un total amputé se lirait
          comme un total. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 165, flexShrink: 0 }}>
        <DeltaText value={j.lpNet} size={32} suffix=" LP" />
        {j.partiel && (
          <div style={{ display: "flex", ...num(14, 400, COLOR.ink4) }}>total partiel</div>
        )}
      </div>

      {/* Où il en est maintenant. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
        <EloCrest tier={j.tier} division={j.division} size={38} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ display: "flex", ...num(23, 600, COLOR.ink) }}>{j.leaguePoints}</div>
            <div style={{ display: "flex", ...num(15, 400, COLOR.ink4) }}>LP</div>
          </div>
          {j.position !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  ...num(15, 500, positif ? COLOR.ink3 : COLOR.ink4),
                }}
              >
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

export function SoireeCard({ model }: { model: SoireeCardModel }) {
  const { height } = soireeCardSize(model);

  /* Le ton de la carte est celui du groupe : la somme des variations connues.
     Une soirée où le ladder a globalement perdu ne doit pas s'ouvrir sur un
     bandeau acide sous prétexte qu'un joueur a bien joué. */
  const bilan = model.joueurs.reduce((a, j) => a + (j.lpNet ?? 0), 0);
  const accent = bilan > 0 ? COLOR.acid : bilan < 0 ? COLOR.blaze : COLOR.ink3;

  return (
    <Frame width={W} height={height}>
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
          height: EN_TETE,
          padding: `0 ${PAD}px 0 ${PAD + 10}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label size={15}>{model.ladderName}</Label>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: accent }}>
            Résumé de la soirée
          </div>
          {/* Horaires absolus, jamais « il y a 2 h » : gravé dans un PNG, un
              relatif ment dès la minute suivante dans l'historique Discord. */}
          <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>
            {`${heure(model.debut)} → ${heure(model.fin)} · ${model.parties} partie${
              model.parties > 1 ? "s" : ""
            }`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
          }}
        >
          <Label size={14}>Bilan du ladder</Label>
          <DeltaText value={model.joueurs.length > 0 ? bilan : null} size={40} suffix=" LP" />
        </div>
      </div>

      {model.joueurs.map((j, i) => (
        <Joueur key={i} j={j} rang={i + 1} />
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
