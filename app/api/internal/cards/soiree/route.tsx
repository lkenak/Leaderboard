import { NextResponse, type NextRequest } from "next/server";
import { SoireeCard, soireeCardSize } from "@/lib/cards/SoireeCard";
import { asset } from "@/lib/cards/assets";
import { refuseNonAutorise } from "@/lib/cards/internal-auth";
import {
  soireeAltText,
  soireeSummary,
  type SoireeCardModel,
  type SoireeJoueurModel,
} from "@/lib/cards/models";
import { renderCard } from "@/lib/cards/render";
import { getLadderBySlug } from "@/lib/db/ladders";
import { listGames } from "@/lib/db/riot-players";
import { championSrc, rankShort } from "@/lib/lol";
import { buildLadderSnapshot } from "@/lib/riot/snapshot";
import type { GameRecord } from "@/lib/types";

/**
 * Rendu du résumé d'une soirée.
 *
 *   GET /api/internal/cards/soiree?slug=<ladder>&depuis=<ms>&jusqua=<ms>
 *
 * Les bornes viennent du bot, qui seul sait quand la soirée s'est arrêtée
 * (`bot/rapports/file.ts`). Les passer plutôt que de les recalculer ici évite
 * que la carte ne couvre pas exactement la période que le bot vient de
 * marquer comme traitée — un décalage d'une partie se verrait au balayage
 * suivant, en double ou en manque.
 *
 * Renvoie **404 quand personne n'a joué dans la fenêtre** : le bot ne devrait
 * pas appeler dans ce cas, mais une partie purgée par la rétention entre sa
 * décision et le rendu suffirait à vider la carte.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Le champion le plus joué de la soirée : c'est lui qui illustre la ligne. */
function championDominant(parties: GameRecord[]): GameRecord {
  const comptes = new Map<string, number>();
  for (const p of parties) comptes.set(p.championId, (comptes.get(p.championId) ?? 0) + 1);
  let meilleur = parties[0];
  let max = 0;
  for (const p of parties) {
    const n = comptes.get(p.championId) ?? 0;
    if (n > max) {
      max = n;
      meilleur = p;
    }
  }
  return meilleur;
}

export async function GET(request: NextRequest) {
  const refus = refuseNonAutorise(request);
  if (refus) return refus;

  const p = request.nextUrl.searchParams;
  const slug = p.get("slug");
  const depuis = Number(p.get("depuis"));
  const jusqua = Number(p.get("jusqua"));
  if (!slug || !Number.isFinite(depuis) || !Number.isFinite(jusqua) || jusqua <= depuis) {
    return NextResponse.json(
      { error: "`slug`, `depuis` et `jusqua` requis, avec `jusqua` postérieur." },
      { status: 400 },
    );
  }

  const ladder = getLadderBySlug(slug);
  if (!ladder) return NextResponse.json({ error: "Ladder introuvable." }, { status: 404 });

  const now = Date.now();
  const { snapshot } = buildLadderSnapshot(ladder.id, now);

  const joueurs: SoireeJoueurModel[] = [];
  const matchs = new Set<string>();

  for (const entry of snapshot.entries) {
    /* Borne basse exclusive, borne haute inclusive : `last_digest_at` retient
       la fin de la dernière partie déjà couverte, donc une borne basse
       inclusive la recompterait à chaque résumé. */
    const parties = listGames(entry.player.puuid).filter(
      (g) => g.endedAt > depuis && g.endedAt <= jusqua,
    );
    if (parties.length === 0) continue;

    for (const g of parties) matchs.add(g.id);

    const connues = parties.filter((g) => g.lpDelta !== null);
    const illustration = championDominant(parties);

    joueurs.push({
      name: entry.player.displayName ?? entry.player.gameName,
      championIcon: asset(championSrc(illustration.championId)),
      championName: illustration.championName,
      wins: parties.filter((g) => g.win).length,
      losses: parties.filter((g) => !g.win).length,
      lpNet:
        connues.length > 0 ? connues.reduce((a, g) => a + (g.lpDelta ?? 0), 0) : null,
      partiel: connues.length < parties.length,
      tier: entry.rank.tier,
      division: entry.rank.division,
      rankShort: rankShort(entry.rank),
      leaguePoints: entry.rank.leaguePoints,
      position: entry.position,
      positionDelta: entry.positionDelta === 0 ? null : entry.positionDelta,
    });
  }

  if (joueurs.length === 0) {
    return NextResponse.json(
      { error: "Aucune partie de ce ladder dans cette fenêtre.", caduc: true },
      { status: 404 },
    );
  }

  /* Meilleure progression d'abord. Les variations inconnues ferment la marche
     plutôt que de compter pour zéro : sans ça, un joueur dont rien n'a pu être
     mesuré passerait devant quelqu'un qui a réellement perdu des LP. */
  joueurs.sort((a, b) => {
    if (a.lpNet === null && b.lpNet === null) return b.wins - a.wins;
    if (a.lpNet === null) return 1;
    if (b.lpNet === null) return -1;
    return b.lpNet - a.lpNet;
  });

  const publicUrl = (process.env.LADDER_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const model: SoireeCardModel = {
    ladderName: ladder.name,
    debut: depuis,
    fin: jusqua,
    parties: matchs.size,
    url: publicUrl ? `${publicUrl}/l/${ladder.slug}` : null,
    joueurs,
  };

  const textes = {
    alt: soireeAltText(model),
    summary: soireeSummary(model),
    url: model.url,
    updatedAt: jusqua,
  };
  const carte = <SoireeCard model={model} />;

  let png: Buffer;
  try {
    png = await renderCard(carte, soireeCardSize(model));
  } catch (err) {
    console.warn(
      `[cartes] rendu du résumé de ${slug} échoué :`,
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
