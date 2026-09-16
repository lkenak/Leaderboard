"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  DuplicateClaimError,
  claimRiotAccount,
  setMainRiotAccount,
  unclaimRiotAccount,
} from "@/lib/db/users";
import { REGIONS } from "@/lib/riot/routing";
import type { Region } from "@/lib/types";
import type { ActionResult } from "@/app/l/[slug]/settings/actions";

/**
 * « Mes comptes » : déclaration libre, aucune vérification de propriété (voir
 * README du projet) — sert uniquement à faire apparaître les ladders où ce
 * compte est membre dans la page « mes ladders » de l'utilisateur connecté.
 */
export async function claimAccountAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Session expirée. Se reconnecter." };

  const raw = String(form.get("riotId") ?? "").trim().replace(/^@/, "");
  const hash = raw.lastIndexOf("#");
  if (hash <= 0 || hash === raw.length - 1) {
    return { ok: false, message: "Riot ID attendu sous la forme « Pseudo#TAG »." };
  }
  const gameName = raw.slice(0, hash).trim();
  const tagLine = raw.slice(hash + 1).trim();
  if (gameName.length < 3 || tagLine.length < 2 || tagLine.length > 5) {
    return { ok: false, message: "Riot ID attendu sous la forme « Pseudo#TAG »." };
  }

  const region = String(form.get("region") ?? "EUW") as Region;
  if (!REGIONS.includes(region)) return { ok: false, message: "Région inconnue." };

  try {
    claimRiotAccount(session.user.id, { gameName, tagLine, region });
  } catch (err) {
    if (err instanceof DuplicateClaimError) return { ok: false, message: err.message };
    throw err;
  }

  revalidatePath("/ladders");
  return { ok: true, message: `${gameName}#${tagLine} ajouté à tes comptes.` };
}

export async function unclaimAccountAction(form: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  unclaimRiotAccount(session.user.id, Number(form.get("id")));
  revalidatePath("/ladders");
}

export async function setMainAccountAction(form: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  setMainRiotAccount(session.user.id, Number(form.get("id")));
  revalidatePath("/ladders");
}
