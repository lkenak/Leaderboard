import { NextResponse, type NextRequest } from "next/server";
import { PlayerCard } from "@/lib/cards/PlayerCard";
import { refuseNonAutorise } from "@/lib/cards/internal-auth";
import { PLAYER_CARD } from "@/lib/cards/layout";
import { buildPlayerCardModel, playerAltText } from "@/lib/cards/models";
import { ensureProfileIcons } from "@/lib/cards/profile-icons";
import { renderCard } from "@/lib/cards/render";
import { getLadderBySlug } from "@/lib/db/ladders";
import { buildLadderSnapshot, buildPlayerEntry } from "@/lib/riot/snapshot";
import type { Region } from "@/lib/types";

/**
 * Rendu de la fiche d'un joueur, pour le bot Discord.
 *
 *   GET /api/internal/cards/player?puuid=…&gameName=…&tagLine=…&region=EUW
 *       &ladder=<slug>        (facultatif — donne la position dans le classement)
 *       &format=png           (pour l'œil, en dev)
 *
 * Le `ladder` est facultatif parce qu'un compte déclaré dans « mes comptes »
 * est relevé par la synchronisation **même s'il n'appartient à aucun ladder**
 * (`listPlayersToSync` fait l'union des deux). On sait donc parler d'un joueur
 * que personne ne suit ; il n'aura simplement pas de position.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const refus = refuseNonAutorise(request);
  if (refus) return refus;

  const p = request.nextUrl.searchParams;
  const puuid = p.get("puuid");
  const gameName = p.get("gameName");
  const tagLine = p.get("tagLine");
  if (!puuid || !gameName || !tagLine) {
    return NextResponse.json(
      { error: "Paramètres `puuid`, `gameName` et `tagLine` requis." },
      { status: 400 },
    );
  }

  const now = Date.now();
  const resultat = buildPlayerEntry(
    { puuid, gameName, tagLine, region: (p.get("region") ?? "EUW") as Region },
    now,
  );

  // Pas de relevé : ce n'est pas une erreur du serveur, c'est un état du
  // compte. Le bot le reformule pour la personne.
  if ("raison" in resultat) {
    return NextResponse.json({ error: resultat.raison, sansReleve: true }, { status: 404 });
  }

  /* Position dans le ladder consulté, si on en a un et que le joueur y est. */
  let position: number | null = null;
  let total = 0;
  let ladderName: string | null = null;
  let url: string | null = null;
  let updatedAt = now;

  const publicUrl = (process.env.LADDER_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const slug = p.get("ladder");
  if (slug) {
    const ladder = getLadderBySlug(slug);
    if (ladder) {
      const { snapshot } = buildLadderSnapshot(ladder.id, now);
      const moi = snapshot.entries.find((e) => e.player.puuid === puuid);
      updatedAt = snapshot.updatedAt;
      if (moi) {
        position = moi.position;
        total = snapshot.entries.length;
        ladderName = ladder.name;
        url = publicUrl ? `${publicUrl}/l/${ladder.slug}` : null;
      }
    }
  }

  await ensureProfileIcons([resultat.entry.player.profileIconId || null]);

  const model = buildPlayerCardModel(resultat.entry, {
    position,
    total,
    ladderName,
    url,
    updatedAt,
  });

  const textes = { alt: playerAltText(model), url: model.url, updatedAt: model.updatedAt };
  const carte = <PlayerCard model={model} />;

  let png: Buffer;
  try {
    png = await renderCard(carte, { width: PLAYER_CARD.width, height: PLAYER_CARD.height });
  } catch (err) {
    console.warn(
      `[cartes] rendu de la fiche ${gameName}#${tagLine} échoué :`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(textes, { status: 503 });
  }

  if (p.get("format") === "png") {
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json(
    { png: png.toString("base64"), ...textes },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
