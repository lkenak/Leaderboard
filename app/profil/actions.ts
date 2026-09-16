"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  DuplicateClaimError,
  claimRiotAccount,
  listClaimedAccounts,
  setMainRiotAccount,
  unclaimRiotAccount,
} from "@/lib/db/users";
import { refreshUser, resumerReleve } from "@/lib/riot/refresh";
import { REGIONS } from "@/lib/riot/routing";
import type { Region } from "@/lib/types";
import type { ActionResult } from "@/app/l/[slug]/settings/actions";

/**
 * « Mes comptes » : déclaration libre, aucune vérification de propriété (voir
 * README du projet). Deux usages : faire apparaître dans « où j'apparais »
 * les ladders où ce compte est suivi, et désigner le compte principal auquel
 * le futur bot Discord reliera l'utilisateur.
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

  // Relevé ciblé, tout de suite et attendu.
  //
  // Avant, le compte était simplement inséré avec `puuid = NULL` et attendait
  // qu'un relevé global veuille bien passer : plusieurs minutes, et il fallait
  // recharger la page pour voir le résultat. Le résoudre ici coûte deux ou
  // trois appels, et rend surtout l'erreur immédiate — un Riot ID mal tapé se
  // dit maintenant sur-le-champ, au lieu d'apparaître en rouge un quart
  // d'heure plus tard.
  const releve = await refreshUser(session.user.id, { force: true });

  revalidatePath("/profil");
  revalidatePath("/ladders");

  const compte = listClaimedAccounts(session.user.id).find(
    (c) => c.gameName === gameName && c.tagLine === tagLine,
  );

  if (compte?.resolveError) {
    return { ok: false, message: `${gameName}#${tagLine} : ${compte.resolveError}` };
  }
  if (releve.statut === "sans-clé") {
    return {
      ok: true,
      message: `${gameName}#${tagLine} ajouté — pas de clé Riot sur le serveur, le rang viendra plus tard.`,
    };
  }
  if (!compte?.puuid) {
    return {
      ok: true,
      message: `${gameName}#${tagLine} ajouté — pas encore retrouvé chez Riot, le prochain relevé réessaiera.`,
    };
  }
  return { ok: true, message: `${gameName}#${tagLine} ajouté et relevé.` };
}

export async function unclaimAccountAction(form: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  unclaimRiotAccount(session.user.id, Number(form.get("id")));
  revalidatePath("/profil");
  revalidatePath("/ladders");
}

export async function setMainAccountAction(form: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  setMainRiotAccount(session.user.id, Number(form.get("id")));
  revalidatePath("/profil");
}

/**
 * Relève les comptes déclarés par la personne connectée.
 *
 * Ciblé sur ses seuls comptes : le site ne relève plus tout le monde à chaque
 * visite, et il n'y a aucune raison de faire attendre quelqu'un pendant qu'on
 * interroge Riot pour des joueurs qu'il ne regarde pas.
 */
export async function refreshMyAccountsAction(
  _prev: ActionResult | null,
  _form?: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Session expirée. Se reconnecter." };

  const resultat = await refreshUser(session.user.id);
  revalidatePath("/profil");
  revalidatePath("/ladders");

  return {
    ok: resultat.statut === "fait" && resultat.report.errors.length === 0,
    message: resumerReleve(resultat),
  };
}
