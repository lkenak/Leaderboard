import { NextResponse, type NextRequest } from "next/server";
import { GameCard, gameCardSize } from "@/lib/cards/GameCard";
import { asset } from "@/lib/cards/assets";
import { refuseNonAutorise } from "@/lib/cards/internal-auth";
import { gameAltText, type GameCardModel, type GameCardPlayer } from "@/lib/cards/models";
import { renderCard } from "@/lib/cards/render";
import { getLadderBySlug } from "@/lib/db/ladders";
import { listGames } from "@/lib/db/riot-players";
import { duration, kdaLabel, kda as kdaOf } from "@/lib/format";
import { championSrc, rankShort } from "@/lib/lol";
import { buildLadderSnapshot } from "@/lib/riot/snapshot";

/**
 * Rendu du compte rendu d'une partie.
 *
 *   GET /api/internal/cards/game?slug=<ladder>&matchId=<EUW1_…>
 *
 * Le bot ne passe qu'un identifiant de partie et un ladder : tout le reste
 * est en base, et c'est le serveur qui sait la lire. Il renvoie **404 quand
 * aucun membre du ladder n'a cette partie** — elle a pu être purgée par la
 * rétention (40 parties par compte) avant qu'on ait pu l'annoncer, ce qui est
 * un cas normal et non une erreur.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const refus = refuseNonAutorise(request);
  if (refus) return refus;

  const p = request.nextUrl.searchParams;
  const slug = p.get("slug");
  const matchId = p.get("matchId");
  if (!slug || !matchId) {
    return NextResponse.json({ error: "`slug` et `matchId` requis." }, { status: 400 });
  }

  const ladder = getLadderBySlug(slug);
  if (!ladder) return NextResponse.json({ error: "Ladder introuvable." }, { status: 404 });

  const now = Date.now();
  const { snapshot } = buildLadderSnapshot(ladder.id, now);

  /* Tous les membres du ladder ayant joué cette partie. Le classement est
     déjà trié et positionné, donc la position affichée est celle d'après la
     partie — ce qu'on veut montrer. */
  const joueurs: GameCardPlayer[] = [];
  let win = false;
  let durationSec = 0;
  let endedAt = now;

  for (const entry of snapshot.entries) {
    const partie = listGames(entry.player.puuid).find((g) => g.id === matchId);
    if (!partie) continue;

    win = partie.win;
    durationSec = partie.durationSec;
    endedAt = partie.endedAt;

    joueurs.push({
      name: entry.player.displayName ?? entry.player.gameName,
      championIcon: asset(championSrc(partie.championId)),
      championName: partie.championName,
      role: partie.role,
      kills: partie.kills,
      deaths: partie.deaths,
      assists: partie.assists,
      kdaLabel: kdaLabel(kdaOf(partie.kills, partie.deaths, partie.assists)),
      cs: partie.cs,
      visionScore: partie.visionScore,
      lpDelta: partie.lpDelta,
      tier: entry.rank.tier,
      division: entry.rank.division,
      rankShort: rankShort(entry.rank),
      leaguePoints: entry.rank.leaguePoints,
      position: entry.position,
      positionDelta: entry.positionDelta === 0 ? null : entry.positionDelta,
      streak:
        entry.streak.type !== "none" && entry.streak.count >= 2
          ? { type: entry.streak.type, count: entry.streak.count }
          : null,
    });
  }

  if (joueurs.length === 0) {
    return NextResponse.json(
      { error: "Aucun membre de ce ladder n'a cette partie.", caduc: true },
      { status: 404 },
    );
  }

  const publicUrl = (process.env.LADDER_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const model: GameCardModel = {
    win,
    durationLabel: duration(durationSec),
    endedAt,
    ladderName: ladder.name,
    total: snapshot.entries.length,
    url: publicUrl ? `${publicUrl}/l/${ladder.slug}` : null,
    players: joueurs,
  };

  const textes = { alt: gameAltText(model), url: model.url, updatedAt: endedAt };
  const carte = <GameCard model={model} />;

  let png: Buffer;
  try {
    png = await renderCard(carte, gameCardSize(model));
  } catch (err) {
    console.warn(
      `[cartes] rendu du compte rendu ${matchId} échoué :`,
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
