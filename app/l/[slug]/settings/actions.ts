"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  DuplicateMemberError,
  addMember,
  forgetMemberPuuid,
  getLadderBySlug,
  patchMember,
  removeMember,
  renameLadder,
  type Bracket,
  type LadderRecord,
} from "@/lib/db/ladders";
import { runSync } from "@/lib/riot/refresh";
import { REGIONS } from "@/lib/riot/routing";
import { ROLES, type Region, type Role, type StreamerHandle } from "@/lib/types";

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

  const bracket = String(form.get("bracket") ?? "high-elo") as Bracket;
  const roleRaw = String(form.get("role") ?? "");
  const role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : undefined;

  const platform = String(form.get("streamPlatform") ?? "");
  const login = String(form.get("streamLogin") ?? "").trim();
  const streamer: StreamerHandle | undefined =
    login && (platform === "twitch" || platform === "kick" || platform === "youtube")
      ? { platform, login }
      : undefined;

  const country = String(form.get("country") ?? "").trim().toUpperCase();
  const teamName = String(form.get("teamName") ?? "").trim();
  const teamTag = String(form.get("teamTag") ?? "").trim().toUpperCase();

  try {
    addMember(
      ladder.id,
      {
        gameName: parsed.gameName,
        tagLine: parsed.tagLine,
        region,
        bracket,
        roleOverride: role,
        streamer,
        country: country.length === 2 ? country : undefined,
        teamName: teamName || undefined,
        teamTag: teamTag || undefined,
      },
      userId,
    );
  } catch (err) {
    if (err instanceof DuplicateMemberError) return { ok: false, message: err.message };
    throw err;
  }

  revalidatePath(`/l/${slug}`);
  revalidatePath(`/l/${slug}/settings`);
  return {
    ok: true,
    message: `${parsed.gameName}#${parsed.tagLine} ajouté. Le prochain relevé résoudra son rang.`,
  };
}

export async function removeAccountAction(slug: string, form: FormData): Promise<void> {
  const guard = await guardOwner(slug);
  if (isGuardFailure(guard)) return;
  removeMember(guard.ladder.id, Number(form.get("id")));
  revalidatePath(`/l/${slug}`);
  revalidatePath(`/l/${slug}/settings`);
}

export async function moveBracketAction(slug: string, form: FormData): Promise<void> {
  const guard = await guardOwner(slug);
  if (isGuardFailure(guard)) return;
  const bracket = String(form.get("bracket")) as Bracket;
  patchMember(guard.ladder.id, Number(form.get("id")), { bracket });
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
  try {
    const report = await runSync();
    revalidatePath(`/l/${slug}/settings`);
    revalidatePath(`/l/${slug}`);
    const parts = [
      `${report.calls} appels`,
      `${report.newSamples} relevé(s)`,
      `${report.newGames} partie(s)`,
      `${report.inGame} en jeu`,
    ];
    if (report.errors.length > 0) parts.push(`${report.errors.length} erreur(s)`);
    return { ok: report.errors.length === 0, message: parts.join(" · ") };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
