"use server";

import { revalidatePath } from "next/cache";
import { getLadderBySlug } from "@/lib/db/ladders";
import { refreshLadder, resumerReleve } from "@/lib/riot/refresh";
import type { ActionResult } from "@/app/l/[slug]/settings/actions";

/**
 * Relève ce ladder, à la demande de qui regarde la page.
 *
 * **Ouvert à tout le monde**, contrairement au bouton des réglages qui est
 * réservé au propriétaire. Un classement est public, et la personne la mieux
 * placée pour savoir qu'il est périmé est celle qui vient de finir sa partie —
 * pas forcément celle qui a créé le ladder.
 *
 * Ce qui protège l'API Riot ici n'est pas une permission mais l'âge minimum
 * d'une minute par portée (`lib/riot/refresh.ts`) : cliquer en boucle ne
 * déclenche qu'un relevé, et seuls les comptes de **ce** ladder sont
 * interrogés.
 */
export async function refreshLadderAction(
  slug: string,
  _prev: ActionResult | null,
  _form?: FormData,
): Promise<ActionResult> {
  const ladder = getLadderBySlug(slug);
  if (!ladder) return { ok: false, message: "Ce ladder n'existe plus." };

  const resultat = await refreshLadder(ladder.id);
  revalidatePath(`/l/${slug}`);

  return {
    ok: resultat.statut === "fait" && resultat.report.errors.length === 0,
    message: resumerReleve(resultat),
  };
}
