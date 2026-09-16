import { LADDER_CARD, ladderCardHeight } from "./layout";
import type { LadderCardModel, LadderRowModel } from "./models";
import { stampLabel } from "./models";
import {
  Crest,
  FormBars,
  Frame,
  Label,
  PositionChip,
  PositionDelta,
  Rail,
  SkewChip,
} from "./primitives";
import { COLOR, FONT, RADIUS, num, ring } from "./tokens";

/**
 * La carte de classement — la transposition de `components/ranking/Ladder.tsx`
 * sous satori.
 *
 * Ce n'est pas une réutilisation : `LadderRow.tsx` est un composant client, en
 * classes Tailwind et en CSS grid, dont rien ne survit ici. C'est une
 * transposition tenue par `tokens.ts` et son garde-fou de build. Les colonnes
 * ci-dessous reprennent l'ordre et les proportions du site pour qu'une capture
 * d'écran et une carte Discord se lisent de la même façon.
 *
 * Tout est en position absolue par colonne plutôt qu'en flex réparti : les
 * chiffres doivent s'aligner verticalement d'une ligne à l'autre, et un flex
 * avec `justify-content: space-between` les ferait danser selon la longueur
 * des pseudos.
 */

const W = LADDER_CARD.width;
const PAD = LADDER_CARD.padX;
const COL = LADDER_CARD.col;

/** Un pseudo trop long pousserait la colonne suivante hors de la carte. */
function tronquer(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function Cell({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: x,
        top: 0,
        height: LADDER_CARD.rowHeight,
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

function Row({ row }: { row: LadderRowModel }) {
  const podium = row.position <= 3;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: W,
        height: LADDER_CARD.rowHeight,
        // Les trois premiers sur un fond légèrement relevé, comme le podium du
        // site ; le reste sur le fond nu.
        background: podium ? COLOR.panel : "transparent",
        borderBottom: `1px solid ${COLOR.hair}`,
      }}
    >
      {/* Barre acide du premier : la 1re place se repère avant de lire. */}
      {row.position === 1 && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            width: 3,
            height: LADDER_CARD.rowHeight,
            background: COLOR.acid,
          }}
        />
      )}

      <Cell x={COL.position}>
        <PositionChip position={row.position} />
      </Cell>

      <Cell x={COL.positionDelta}>
        <PositionDelta delta={row.positionDelta} />
      </Cell>

      {/* L'icône vient du cache disque rempli avant le rendu
          (`lib/cards/profile-icons.ts`) ; à défaut, la pastille d'initiale,
          comme `components/ui/Avatar.tsx` quand le chargement échoue. */}
      <Cell x={COL.avatar}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: RADIUS.sm,
            overflow: "hidden",
            background: COLOR.panel3,
            boxShadow: ring(row.live ? "rgba(233, 255, 31, 0.7)" : COLOR.hair),
            fontFamily: FONT.sans,
            fontSize: 22,
            fontWeight: 600,
            color: COLOR.ink3,
          }}
        >
          {row.icon ? (
            <img src={row.icon} width={48} height={48} alt="" />
          ) : (
            row.name.slice(0, 1).toLocaleUpperCase("fr")
          )}
        </div>
      </Cell>

      <Cell x={COL.name}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: COLOR.ink }}>
              {tronquer(row.name, 22)}
            </div>
            {row.live && (
              <div
                style={{
                  display: "flex",
                  padding: "3px 10px",
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
          <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>{`#${row.tag}`}</div>
        </div>
      </Cell>

      <Cell x={COL.crest}>
        <Crest tier={row.tier} size={40} />
      </Cell>

      <Cell x={COL.lp}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <div style={{ display: "flex", ...num(26, 600, COLOR.ink) }}>{row.leaguePoints}</div>
          <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>LP</div>
        </div>
        <div style={{ display: "flex", marginLeft: 12, ...num(18, 500, COLOR.ink3) }}>
          {row.rankShort}
        </div>
      </Cell>

      {/* Le pourcentage, puis le détail en dessous. Pas de barre de proportion :
          elle disait exactement la même chose que le pourcentage, juste
          au-dessus, et c'est elle qui faisait déborder la colonne. */}
      <Cell x={COL.winrate}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              display: "flex",
              ...num(26, 600, row.winrate >= 50 ? COLOR.ink : COLOR.ink2),
            }}
          >
            {`${row.winrate} %`}
          </div>
          <div style={{ display: "flex", ...num(16, 400, COLOR.ink4) }}>
            {`${row.wins}V · ${row.losses}D`}
          </div>
        </div>
      </Cell>

      <Cell x={COL.form}>
        {row.form.length > 0 ? (
          <FormBars form={row.form} />
        ) : (
          <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>—</div>
        )}
      </Cell>
    </div>
  );
}

function Vide() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: W,
        height: LADDER_CARD.rowHeight * 3,
        gap: 10,
      }}
    >
      <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: COLOR.ink2 }}>
        Aucun joueur classé
      </div>
      <Label size={16}>Ajoute des comptes, le relevé fera le reste</Label>
    </div>
  );
}

/**
 * La taille de la toile, calculée une seule fois ici.
 *
 * L'appelant (`app/api/internal/cards/ladder/route.tsx`) doit passer
 * exactement ces dimensions à `renderCard` : satori peint le `Frame`, mais
 * c'est `ImageResponse` qui fixe la taille du PNG. Si les deux divergent, la
 * différence sort en blanc — c'est ce qui est arrivé avec un ladder de deux
 * joueurs contre un plancher à trois lignes.
 */
export function ladderCardSize(model: LadderCardModel): { width: number; height: number } {
  // Le plancher de 3 lignes vaut pour le cartouche « aucun joueur classé »,
  // qui occupe la hauteur de trois lignes ; au-delà, la carte suit le nombre
  // réel de joueurs.
  const lignes = model.rows.length;
  return { width: W, height: ladderCardHeight(lignes === 0 ? 3 : lignes) };
}

export function LadderCard({ model }: { model: LadderCardModel }) {
  const lignes = model.rows.length;
  const { height: hauteur } = ladderCardSize(model);

  return (
    <Frame width={W} height={hauteur}>
      {/* En-tête */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: W,
          height: LADDER_CARD.headerHeight,
          padding: `0 ${PAD}px`,
          borderBottom: `2px solid ${COLOR.hair2}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: COLOR.ink }}>
            {tronquer(model.ladderName, 30)}
          </div>
          <Label size={16}>{`Classement SoloQ · relevé du ${stampLabel(model.updatedAt)}`}</Label>
        </div>
        {lignes > 0 && <SkewChip>{`Top ${lignes}`}</SkewChip>}
      </div>

      {/* Lignes */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {lignes === 0 ? <Vide /> : model.rows.map((r) => <Row key={r.position} row={r} />)}
      </div>

      {/* Pied */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: W,
          height: LADDER_CARD.footerHeight - 4,
          padding: `0 ${PAD}px`,
        }}
      >
        <Label size={16}>
          {model.url
            ? `soloq/ladder · ${model.url.replace(/^https?:\/\//, "")}`
            : "soloq/ladder"}
        </Label>
        <Label size={16}>
          {model.total > lignes
            ? `${model.total} joueurs · ${model.splitName}`
            : model.splitName}
        </Label>
      </div>
      <Rail />
    </Frame>
  );
}
