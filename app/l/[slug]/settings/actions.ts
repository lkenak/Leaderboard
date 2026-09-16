"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  DuplicateMemberError,
  addMember,
  forgetMemberPuuid,
  getLadderBySlug,
  listMembers,
  removeMember,
  renameLadder,
  type LadderRecord,
} from "@/lib/db/ladders";
import { refreshLadder, resumerReleve } from "@/lib/riot/refresh";
import { REGIONS } from "@/lib/riot/routing";
import { ROLES, type Region, type Role } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Vérifie la session ET la propriété du ladder — défense en profondeur,
 *  le middleware ne protège pas un appel Server Action direct. */
async function guardOwner(
  slug: string,
): Promise<{ ladder: LadderRecord; userId: string } | ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Session expirée. Se reconnecter." };
  const ladder = getLadderBySlug(slug);
  if (!ladder) return { ok: false, message: "Ladder introuvable." };
  if (ladder.ownerUserId !== session.user.id) {
    return { ok: false, message: "Tu n'es pas propriétaire de ce ladder." };
  }
  return { ladder, userId: session.user.id };
}

function isGuardFailure(v: { ladder: LadderRecord; userId: string } | ActionResult): v is ActionResult {
  return !("ladder" in v);
}

/**
 * Sépare un Riot ID saisi en un seul champ. C'est le format que le joueur voit
 * en jeu et qu'il copie depuis n'importe quel site de statistiques, donc le
 * seul raisonnable à demander — plutôt que deux champs à remplir séparément.
 */
export async function parseRiotId(
  raw: string,
): Promise<{ gameName: string; tagLine: string } | null> {
  const trimmed = raw.trim().replace(/^@/, "");
  const hash = trimmed.lastIndexOf("#");
  if (hash <= 0 || hash === trimmed.length - 1) return null;
  const gameName = trimmed.slice(0, hash).trim();
  const tagLine = trimmed.slice(hash + 1).trim();
  if (gameName.length < 3 || tagLine.length < 2 || tagLine.length > 5) return null;
  return { gameName, tagLine };
}

export async function addAccountAction(
  slug: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const guard = await guardOwner(slug);
  if (isGuardFailure(guard)) return guard;
  const { ladder, userId } = guard;

  const parsed = await parseRiotId(String(form.get("riotId") ?? ""));
  if (!parsed) {
    return {
      ok: false,
      message:
        "Riot ID attendu sous la forme « Pseudo#TAG » — celui affiché en jeu, pas l'ancien nom d'invocateur.",
    };
  }

  const region = String(form.get("region") ?? "EUW") as Region;
  if (!REGIONS.includes(region)) return { ok: false, message: "Région inconnue." };

  const roleRaw = String(form.get("role") ?? "");
  const role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : undefined;

  const country = String(form.get("country") ?? "").trim().toUpperCase();

  try {
    addMember(
      ladder.id,
      {
        gameName: parsed.gameName,
        tagLine: parsed.tagLine,
        region,
        roleOverride: role,
        country: country.length === 2 ? country : undefined,
      },
      userId,
    );
  } catch (err) {
    if (err instanceof DuplicateMemberError) return { ok: false, message: err.message };
    throw err;
  }

  // Relevé ciblé de ce seul ladder, tout de suite et attendu : le compte
  // n'attend plus qu'un relevé global veuille bien passer. Deux ou trois
  // appels, et surtout un Riot ID mal tapé se signale sur-le-champ au lieu
  // d'apparaître en rouge un quart d'heure plus tard.
  await refreshLadder(ladder.id, { force: true });

  revalidatePath(`/l/${slug}`);
  revalidatePath(`/l/${slug}/settings`);

  const label = `${parsed.gameName}#${parsed.tagLine}`;
  const membre = listMembers(ladder.id).find(
    (m) => m.gameName === parsed.gameName && m.tagLine === parsed.tagLine,
  );
  if (membre?.resolveError) return { ok: false, message: `${label} : ${membre.resolveError}` };
  if (!membre?.puuid) {
    return { ok: true, message: `${label} ajouté — pas encore retrouvé chez Riot.` };
  }
  return { ok: true, message: `${label} ajouté et relevé.` };
}

export async function removeAccountAction(slug: string, form: FormData): Promise<void> {
  const guard = await guardOwner(slug);
  if (isGuardFailure(guard)) return;
  removeMember(guard.ladder.id, Number(form.get("id")));
  revalidatePath(`/l/${slug}`);
  revalidatePath(`/l/${slug}/settings`);
}

/** Oublie le puuid résolu pour ce membre, forçant une nouvelle résolution du
 *  Riot ID au prochain relevé — utile après un renommage ou une saisie
 *  corrigée. N'affecte que cette appartenance, jamais les autres ladders qui
 *  référenceraient le même compte. */
export async function retryAccountAction(slug: string, form: FormData): Promise<void> {
  const guard = await guardOwner(slug);
  if (isGuardFailure(guard)) return;
  forgetMemberPuuid(guard.ladder.id, Number(form.get("id")));
  // Sans ce relevé, « réessayer » se contentait d'effacer le puuid et de
  // laisser la ligne dans le même état : rien de visible, et l'impression que
  // le bouton ne marche pas.
  await refreshLadder(guard.ladder.id, { force: true });
  revalidatePath(`/l/${slug}`);
  revalidatePath(`/l/${slug}/settings`);
}

export async function renameLadderAction(
  slug: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const guard = await guardOwner(slug);
  if (isGuardFailure(guard)) return guard;
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Nom trop court." };
  const updated = renameLadder(guard.ladder.id, name);
  if (!updated) return { ok: false, message: "Ladder introuvable." };
  revalidatePath(`/l/${slug}`);
  revalidatePath(`/l/${slug}/settings`);
  revalidatePath("/ladders");
  return updated.slug === slug
    ? { ok: true, message: "Renommé." }
    : { ok: true, message: `Renommé — nouvelle adresse : /l/${updated.slug}` };
}

export async function syncNowAction(
  slug: string,
  _prev: ActionResult | null,
  _form?: FormData,
): Promise<ActionResult> {
  const guard = await guardOwner(slug);
  if (isGuardFailure(guard)) return guard;
  if (!process.env.RIOT_API_KEY) {
    return {
      ok: false,
      message:
        "RIOT_API_KEY absente : copier .env.example vers .env.local, y coller une clé personnelle, puis relancer le serveur.",
    };
  }
  // Ce ladder seulement, et non tous les comptes suivis par le site : c'est
  // celui-là qu'on regarde, et relever les autres ferait attendre pour rien
  // en consommant du quota que personne n'a demandé.
  const resultat = await refreshLadder(guard.ladder.id);
  revalidatePath(`/l/${slug}/settings`);
  revalidatePath(`/l/${slug}`);
  return {
    ok: resultat.statut === "fait" && resultat.report.errors.length === 0,
    message: resumerReleve(resultat),
  };
}
