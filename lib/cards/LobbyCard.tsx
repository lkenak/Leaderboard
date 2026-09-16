import { crestSrc, roleSrc } from "@/lib/lol";
import { asset } from "./assets";
import { LOBBY_CARD } from "./layout";
import type { LobbyCardModel, LobbyPlayerModel } from "./models";
import { Frame, Label, Rail, tierColor } from "./primitives";
import { COLOR, FONT, num, ring } from "./tokens";

/**
 * Le lobby d'une partie personnalisée.
 *
 * Elle se redessine à **chaque clic**, ce qui en fait la carte la plus
 * exigeante des quatre : tout ce qui est coûteux ici se paie vingt fois dans
 * une soirée. D'où les choix d'économie — pas d'icône de profil (ce sont des
 * comptes Discord, pas des comptes Riot, et rien n'est en cache), pas
 * d'emblème de palier, uniquement des crests SVG déjà chargés au démarrage.
 *
 * Le rang affiché vient du compte lié quand il existe. Un joueur non lié n'est
 * pas une case vide : il est marqué comme tel, parce que c'est une chose qu'il
 * peut corriger.
 */

const W = LOBBY_CARD.width;
const PAD = LOBBY_CARD.padX;

export function lobbyCardSize(model: LobbyCardModel): { width: number; height: number } {
  const lignes = Math.ceil(model.maxPlayers / 2);
  const attente = model.waitlist.length > 0 ? 34 + model.waitlist.length * 32 : 0;
  return {
    width: W,
    height: LOBBY_CARD.headerHeight + lignes * LOBBY_CARD.rowHeight + attente + LOBBY_CARD.footerHeight,
  };
}

function tronquer(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** `00:04`, pas `0:4` — les deux chiffres, toujours. */
function heure(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Une place, occupée ou libre. Les places libres se comptent d'un coup d'œil. */
function Place({ index, joueur }: { index: number; joueur: LobbyPlayerModel | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: (W - PAD * 2 - 24) / 2,
        height: LOBBY_CARD.rowHeight,
      }}
    >
      <div style={{ display: "flex", width: 26, ...num(18, 500, COLOR.ink4) }}>
        {String(index).padStart(2, "0")}
      </div>

      {joueur === null ? (
        <div style={{ display: "flex", ...num(20, 400, COLOR.ink4) }}>—</div>
      ) : (
        <>
          <img src={asset(crestSrc(joueur.tier ?? "UNRANKED"))} width={30} height={30} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: COLOR.ink }}>
              {tronquer(joueur.name, 16)}
            </div>
            <div
              style={{
                display: "flex",
                ...num(16, 400, joueur.rankShort ? tierColor(joueur.tier ?? "UNRANKED") : COLOR.ink4),
              }}
            >
              {joueur.rankShort ?? "compte non lié"}
              {joueur.rankShort && !joueur.mesure ? " · déclaré" : ""}
            </div>
          </div>
          {joueur.role && (
            <img
              src={asset(roleSrc(joueur.role))}
              width={22}
              height={22}
              style={{ marginLeft: "auto" }}
              alt=""
            />
          )}
        </>
      )}
    </div>
  );
}

export function LobbyCard({ model }: { model: LobbyCardModel }) {
  const { height } = lobbyCardSize(model);
  const lignes = Math.ceil(model.maxPlayers / 2);
  const rempli = model.participants.length;
  const accent = model.cancelled ? COLOR.blaze : COLOR.acid;

  // Deux colonnes remplies en serpentin vertical : la colonne de gauche prend
  // les premières places, celle de droite la suite — comme une feuille
  // d'inscription, pas comme un tableau à lire en zigzag.
  const places: Array<LobbyPlayerModel | null> = Array.from(
    { length: model.maxPlayers },
    (_, i) => model.participants[i] ?? null,
  );

  return (
    <Frame width={W} height={height}>
      {/* En-tête */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: W,
          height: LOBBY_CARD.headerHeight,
          padding: `0 ${PAD}px`,
          borderBottom: `2px solid ${COLOR.hair2}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Label size={15}>Partie personnalisée</Label>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: COLOR.ink }}>
            {`${model.mode} · ${model.format}`}
          </div>
          <div style={{ display: "flex", ...num(22, 500, COLOR.ink2) }}>{model.instant}</div>
          <div style={{ display: "flex", ...num(18, 400, COLOR.ink4) }}>
            {`Organisée par ${tronquer(model.organizer, 20)}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div style={{ display: "flex", ...num(64, 600, accent) }}>{rempli}</div>
            <div style={{ display: "flex", ...num(34, 400, COLOR.ink4) }}>
              {`/${model.maxPlayers}`}
            </div>
          </div>
          <div style={{ display: "flex", width: 220, height: 8, background: COLOR.panel3 }}>
            <div
              style={{
                display: "flex",
                width: Math.round((rempli / model.maxPlayers) * 220),
                height: 8,
                background: accent,
              }}
            />
          </div>
          {model.unavailable > 0 && (
            <div style={{ display: "flex", ...num(16, 400, COLOR.ink4) }}>
              {`${model.unavailable} indisponible${model.unavailable > 1 ? "s" : ""}`}
            </div>
          )}
        </div>
      </div>

      {/* Places, deux colonnes */}
      <div style={{ display: "flex", padding: `8px ${PAD}px 0 ${PAD}px`, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {places.slice(0, lignes).map((j, i) => (
            <Place key={i} index={i + 1} joueur={j} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {places.slice(lignes).map((j, i) => (
            <Place key={lignes + i} index={lignes + i + 1} joueur={j} />
          ))}
        </div>
      </div>

      {/* File d'attente */}
      {model.waitlist.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: W,
              height: 34,
              padding: `0 ${PAD}px`,
              background: COLOR.panel2,
            }}
          >
            <Label size={14}>{`File d'attente (${model.waitlist.length})`}</Label>
          </div>
          {model.waitlist.map((j, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                height: 32,
                padding: `0 ${PAD}px`,
              }}
            >
              <div style={{ display: "flex", ...num(16, 400, COLOR.ink4) }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ display: "flex", fontSize: 20, fontWeight: 500, color: COLOR.ink2 }}>
                {tronquer(j.name, 20)}
              </div>
              <div style={{ display: "flex", ...num(16, 400, COLOR.ink4) }}>
                {j.rankShort ?? ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bandeau d'annulation */}
      {model.cancelled && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: height / 2 - 34,
            left: -40,
            width: W + 80,
            height: 68,
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 45, 85, 0.92)",
            transform: "skewY(-3deg)",
            boxShadow: ring("rgba(255, 45, 85, 0.5)", 3),
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: FONT.mono,
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: 6,
              color: COLOR.void,
            }}
          >
            ANNULÉE
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: "auto",
          padding: `0 ${PAD}px 14px ${PAD}px`,
        }}
      >
        <Label size={14}>
          {model.cancelled ? "Cette PP a été annulée" : "Les boutons ci-dessous"}
        </Label>
        <div style={{ display: "flex", ...num(15, 400, COLOR.ink4) }}>{`MAJ ${heure(model.updatedAt)}`}</div>
      </div>
      <Rail width="24%" color={accent} />
    </Frame>
  );
}
