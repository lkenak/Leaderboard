import { emblemSrc } from "@/lib/lol";
import { PLAYER_CARD } from "./layout";
import type { PlayerCardModel } from "./models";
import { stampLabel } from "./models";
import { asset } from "./assets";
import {
  Crest,
  DeltaText,
  FormBars,
  Frame,
  Label,
  Rail,
  RoleGlyph,
  SkewChip,
  tierColor,
} from "./primitives";
import { COLOR, FONT, RADIUS, num, ring } from "./tokens";

/**
 * La fiche d'un joueur — la transposition du `Podium` du site.
 *
 * Contrairement à la carte de classement, celle-ci **garde le bilan 24 h** :
 * sur une fiche individuelle c'est l'information du jour, alors que dans un
 * tableau de douze lignes elle encombrait sans rien apprendre que la forme ne
 * disait déjà.
 */

const W = PLAYER_CARD.width;
const H = PLAYER_CARD.height;
const PAD = PLAYER_CARD.padX;

function Stat({ libelle, valeur, couleur = COLOR.ink }: {
  libelle: string;
  valeur: string;
  couleur?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <Label size={14}>{libelle}</Label>
      <div style={{ display: "flex", ...num(28, 600, couleur) }}>{valeur}</div>
    </div>
  );
}

export function PlayerCard({ model }: { model: PlayerCardModel }) {
  return (
    <Frame width={W} height={H}>
      {/* Emblème du palier en filigrane, débordant du coin — le motif de
          `components/ranking/Podium.tsx`. C'est ce qui fait qu'on reconnaît
          le palier avant d'avoir lu quoi que ce soit. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: -60,
          right: -70,
          width: 380,
          height: 380,
          opacity: 0.19,
        }}
      >
        <img src={asset(emblemSrc(model.tier))} width={380} height={380} alt="" />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: `32px ${PAD}px 0 ${PAD}px`,
        }}
      >
        {/* Identité */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: RADIUS.md,
              overflow: "hidden",
              background: COLOR.panel3,
              boxShadow: ring(model.live ? "rgba(233, 255, 31, 0.7)" : COLOR.hair2),
              fontFamily: FONT.sans,
              fontSize: 32,
              fontWeight: 600,
              color: COLOR.ink3,
            }}
          >
            {model.icon ? (
              <img src={model.icon} width={72} height={72} alt="" />
            ) : (
              model.name.slice(0, 1).toLocaleUpperCase("fr")
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: COLOR.ink }}>
                {model.name.length > 16 ? `${model.name.slice(0, 15)}…` : model.name}
              </div>
              <RoleGlyph role={model.role} size={30} />
              {model.live && (
                <div
                  style={{
                    display: "flex",
                    padding: "4px 12px",
                    borderRadius: RADIUS.xs,
                    background: "rgba(233, 255, 31, 0.18)",
                    fontFamily: FONT.mono,
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: 1.6,
                    color: COLOR.acid,
                  }}
                >
                  EN JEU
                </div>
              )}
            </div>
            <div style={{ display: "flex", ...num(20, 400, COLOR.ink4) }}>{`#${model.tag}`}</div>
          </div>

          {/* Position dans le ladder, à droite. Absente quand le joueur n'est
              dans aucun classement suivi par ce serveur — ce qui est un cas
              normal, pas une donnée manquante. */}
          {model.position !== null && (
            <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", gap: 14 }}>
              <SkewChip>{`#${model.position} / ${model.total}`}</SkewChip>
            </div>
          )}
        </div>

        {/* Le chiffre de tête */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 26 }}>
          <Crest tier={model.tier} size={72} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div
              style={{
                display: "flex",
                fontFamily: FONT.mono,
                fontSize: 88,
                fontWeight: 600,
                letterSpacing: -2.6,
                lineHeight: 1,
                color: COLOR.ink,
              }}
            >
              {model.leaguePoints}
            </div>
            <div style={{ display: "flex", ...num(28, 400, COLOR.ink3) }}>LP</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginLeft: "auto",
              alignItems: "flex-end",
            }}
          >
            <Label size={14}>24 heures</Label>
            <DeltaText value={model.sessionLp} size={34} suffix=" LP" />
            <div style={{ display: "flex", ...num(16, 400, COLOR.ink4) }}>
              {model.sessionGames === 0
                ? "aucune partie"
                : `${model.sessionWins}V · ${model.sessionLosses}D`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: tierColor(model.tier) }}>
            {model.rankLabel}
          </div>
          <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>
            {`Pic : ${model.peakLabel}`}
          </div>
          {model.streak && (
            <div
              style={{
                display: "flex",
                padding: "4px 12px",
                borderRadius: RADIUS.xs,
                background:
                  model.streak.type === "win"
                    ? "rgba(233, 255, 31, 0.18)"
                    : "rgba(255, 45, 85, 0.18)",
                fontFamily: FONT.mono,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: 1.4,
                color: model.streak.type === "win" ? COLOR.acid : COLOR.blaze,
              }}
            >
              {`${model.streak.count} ${model.streak.type === "win" ? "VICTOIRES" : "DÉFAITES"} D'AFFILÉE`}
            </div>
          )}
        </div>

        {/* Bandeau de statistiques */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 46,
            marginTop: "auto",
            paddingTop: 22,
            paddingBottom: 22,
            borderTop: `1px solid ${COLOR.hair}`,
          }}
        >
          <Stat libelle="Bilan" valeur={`${model.wins}V · ${model.losses}D`} />
          <Stat
            libelle="Winrate"
            valeur={`${model.winrate} %`}
            couleur={model.winrate >= 50 ? COLOR.ink : COLOR.ink2}
          />
          <Stat libelle="KDA" valeur={model.kdaLabel} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label size={14}>Champions</Label>
            <div style={{ display: "flex", gap: 8 }}>
              {model.champions.length > 0 ? (
                model.champions.map((c) => (
                  <img
                    key={c.icon}
                    src={c.icon}
                    width={44}
                    height={44}
                    style={{ borderRadius: RADIUS.sm }}
                    alt=""
                  />
                ))
              ) : (
                <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>—</div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: "auto" }}>
            <Label size={14}>Forme</Label>
            {model.form.length > 0 ? (
              <FormBars form={model.form} />
            ) : (
              <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>—</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", padding: `0 ${PAD}px 16px ${PAD}px` }}>
        <Label size={14}>{`Relevé du ${stampLabel(model.updatedAt)}`}</Label>
      </div>
      <Rail width="30%" />
    </Frame>
  );
}
