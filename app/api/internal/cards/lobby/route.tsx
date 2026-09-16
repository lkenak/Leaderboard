import { NextResponse, type NextRequest } from "next/server";
import { LobbyCard, lobbyCardSize } from "@/lib/cards/LobbyCard";
import { refuseNonAutorise } from "@/lib/cards/internal-auth";
import { lobbyAltText, type LobbyCardModel } from "@/lib/cards/models";
import { renderCard } from "@/lib/cards/render";

/**
 * Rendu du lobby d'une partie personnalisée.
 *
 * Seule route de carte qui reçoit son modèle **en POST** plutôt que de le
 * reconstruire depuis la base. Deux raisons :
 *
 *  - le modèle mêle des données Discord (noms d'affichage, que seul le bot
 *    connaît) et des données du site (rangs), donc personne d'autre que le bot
 *    ne peut l'assembler ;
 *  - cette carte se redessine à chaque clic, et refaire ici les mêmes requêtes
 *    que le bot vient de faire serait payé vingt fois par soirée.
 *
 * Le serveur web ne fait donc ici qu'une chose : dessiner. Le modèle vient
 * d'un appelant de confiance, sur la boucle locale, derrière le même secret
 * que les autres routes internes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const refus = refuseNonAutorise(request);
  if (refus) return refus;

  let model: LobbyCardModel;
  try {
    model = (await request.json()) as LobbyCardModel;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!Array.isArray(model?.participants) || typeof model?.maxPlayers !== "number") {
    return NextResponse.json({ error: "Modèle de lobby incomplet." }, { status: 400 });
  }

  const textes = { alt: lobbyAltText(model), url: null, updatedAt: model.updatedAt };
  const carte = <LobbyCard model={model} />;

  let png: Buffer;
  try {
    png = await renderCard(carte, lobbyCardSize(model));
  } catch (err) {
    console.warn("[cartes] rendu du lobby échoué :", err instanceof Error ? err.message : err);
    return NextResponse.json(textes, { status: 503 });
  }

  if (request.nextUrl.searchParams.get("format") === "png") {
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json(
    { png: png.toString("base64"), ...textes },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
