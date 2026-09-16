import { NextResponse, type NextRequest } from "next/server";
import { LadderCard, ladderCardSize } from "@/lib/cards/LadderCard";
import { ladderFallbackEmbed } from "@/lib/cards/fallback";
import { refuseNonAutorise } from "@/lib/cards/internal-auth";
import { LADDER_CARD } from "@/lib/cards/layout";
import { buildLadderCardModel, ladderAltText, ladderSummary } from "@/lib/cards/models";
import { renderCard } from "@/lib/cards/render";
import { getLadderBySlug } from "@/lib/db/ladders";
import { buildLadderSnapshot } from "@/lib/riot/snapshot";

/**
 * Rendu de la carte de classement, pour le bot Discord.
 *
 * Le bot lit la base lui-même ; il ne passe par ici que pour l'image, parce
 * que le moteur de rendu, les polices et les assets vivent dans le serveur
 * Next. Un seul aller-retour lui rend l'image **et** les textes qui doivent
 * l'accompagner : le texte alternatif (lecteurs d'écran), le résumé (images
 * désactivées, recherche dans l'historique) et l'embed de repli.
 *
 *   GET /api/internal/cards/ladder?slug=…&n=10
 *   GET /api/internal/cards/ladder?slug=…&format=png   (pour l'œil, en dev)
 *
 * Sur échec de rendu : **503 avec le repli**, jamais une erreur sèche. Le
 * classement ne doit pas disparaître de Discord parce que satori a trébuché.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const refus = refuseNonAutorise(request);
  if (refus) return refus;

  const params = request.nextUrl.searchParams;
  const slug = params.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Paramètre `slug` manquant." }, { status: 400 });
  }

  const ladder = getLadderBySlug(slug);
  if (!ladder) {
    return NextResponse.json({ error: `Ladder « ${slug} » introuvable.` }, { status: 404 });
  }

  const demande = Number(params.get("n") ?? 10);
  const maxRows = Number.isFinite(demande)
    ? Math.min(Math.max(Math.trunc(demande), 1), LADDER_CARD.maxRows)
    : 10;

  // Lecture pure : `buildLadderSnapshot` ne touche jamais le réseau. Le relevé
  // Riot, lui, est déclenché ailleurs (minuteur systemd, visite du site, ou
  // `/classement frais:true` qui appelle /api/refresh).
  const { snapshot } = buildLadderSnapshot(ladder.id, Date.now());

  const publicUrl = (process.env.LADDER_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const model = buildLadderCardModel(snapshot, {
    ladderName: ladder.name,
    slug: ladder.slug,
    publicUrl,
    maxRows,
  });

  const textes = {
    alt: ladderAltText(model),
    summary: ladderSummary(model),
    url: model.url,
    updatedAt: model.updatedAt,
    fallback: ladderFallbackEmbed(model),
  };

  // L'élément est construit hors du try : seul `renderCard` peut échouer, et
  // c'est lui qu'on veut attraper.
  const carte = <LadderCard model={model} />;

  let png: Buffer;
  try {
    // Les dimensions viennent du composant lui-même : `ImageResponse` fixe la
    // taille du PNG, le composant peint le fond, et toute divergence entre les
    // deux sort en blanc au bas de la carte.
    png = await renderCard(carte, ladderCardSize(model));
  } catch (err) {
    console.warn(
      `[cartes] rendu du classement ${slug} échoué :`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(textes, { status: 503 });
  }

  if (params.get("format") === "png") {
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    });
  }

  // base64 plutôt qu'un multipart : +33 % sur la boucle locale, ce qui n'est
  // pas mesurable, en échange d'une réponse unique que le bot lit d'un bloc.
  return NextResponse.json(
    { png: png.toString("base64"), ...textes },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
