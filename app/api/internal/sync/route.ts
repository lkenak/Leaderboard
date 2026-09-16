import { NextResponse, type NextRequest } from "next/server";
import { refuseNonAutorise } from "@/lib/cards/internal-auth";
import { getLadderBySlug } from "@/lib/db/ladders";
import { refreshLadder, refreshUser, resumerReleve } from "@/lib/riot/refresh";

/**
 * Relevé ciblé, pour le bot Discord.
 *
 *   POST /api/internal/sync   { "kind": "ladder", "slug": "test-2" }
 *   POST /api/internal/sync   { "kind": "utilisateur", "userId": "…" }
 *
 * Le bot lit la base directement mais n'a pas le droit d'appeler l'API Riot :
 * le limiteur de débit de `lib/riot/client.ts` est une instance de module, et
 * un second processus qui appellerait Riot doublerait le débit sans que rien
 * ne le voie. Il passe donc par ici.
 *
 * Ciblé et non global, contrairement à `/api/refresh` : une commande affiche
 * un classement ou une fiche, et faire attendre son auteur pendant qu'on
 * interroge Riot pour des joueurs qu'il ne regarde pas n'a pas de sens.
 *
 * L'âge minimum d'une minute est appliqué côté `refresh.ts` : appeler cette
 * route en boucle ne déclenche qu'un relevé.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Corps {
  kind?: "ladder" | "utilisateur";
  slug?: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  const refus = refuseNonAutorise(request);
  if (refus) return refus;

  let corps: Corps;
  try {
    corps = (await request.json()) as Corps;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (corps.kind === "ladder") {
    if (!corps.slug) return NextResponse.json({ error: "`slug` requis." }, { status: 400 });
    const ladder = getLadderBySlug(corps.slug);
    if (!ladder) {
      return NextResponse.json({ error: `Ladder « ${corps.slug} » introuvable.` }, { status: 404 });
    }
    const resultat = await refreshLadder(ladder.id);
    return NextResponse.json({ statut: resultat.statut, message: resumerReleve(resultat) });
  }

  if (corps.kind === "utilisateur") {
    if (!corps.userId) return NextResponse.json({ error: "`userId` requis." }, { status: 400 });
    const resultat = await refreshUser(corps.userId);
    return NextResponse.json({ statut: resultat.statut, message: resumerReleve(resultat) });
  }

  return NextResponse.json({ error: "`kind` doit valoir « ladder » ou « utilisateur »." }, { status: 400 });
}
