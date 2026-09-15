"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, signIn, signOut } from "@/lib/admin";
import {
  DuplicateAccountError,
  addAccount,
  patchAccount,
  removeAccount,
  type Bracket,
} from "@/lib/store";
import { runSync } from "@/lib/riot/refresh";
import { REGIONS } from "@/lib/riot/routing";
import { ROLES, type Region, type Role, type StreamerHandle } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

async function guard(): Promise<ActionResult | null> {
  if (await isAdmin()) return null;
  return { ok: false, message: "Session expirée. Se reconnecter." };
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
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

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
  const role = (ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as Role)
    : undefined;

  const platform = String(form.get("streamPlatform") ?? "");
  const login = String(form.get("streamLogin") ?? "").trim();
  const streamer: StreamerHandle | undefined =
    login && (platform === "twitch" || platform === "kick" || platform === "youtube")
      ? { platform, login }
      : undefined;

  const country = String(form.get("country") ?? "")
    .trim()
    .toUpperCase();
  const teamName = String(form.get("teamName") ?? "").trim();
  const teamTag = String(form.get("teamTag") ?? "")
    .trim()
    .toUpperCase();

  try {
    await addAccount({
      gameName: parsed.gameName,
      tagLine: parsed.tagLine,
      region,
      bracket,
      roleOverride: role,
      streamer,
      country: country.length === 2 ? country : undefined,
      teamName: teamName || undefined,
      teamTag: teamTag || undefined,
    });
  } catch (err) {
    if (err instanceof DuplicateAccountError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  revalidatePath("/admin");
  revalidatePath("/ranking");
  return {
    ok: true,
    message: `${parsed.gameName}#${parsed.tagLine} ajouté. Le prochain relevé résoudra son rang.`,
  };
}

export async function removeAccountAction(form: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  await removeAccount(String(form.get("id")));
  revalidatePath("/admin");
  revalidatePath("/ranking");
}

export async function moveBracketAction(form: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const bracket = String(form.get("bracket")) as Bracket;
  await patchAccount(String(form.get("id")), { bracket });
  revalidatePath("/admin");
  revalidatePath("/ranking");
}

/** Force une nouvelle résolution du Riot ID : utile après un renommage. */
export async function retryAccountAction(form: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  await patchAccount(String(form.get("id")), {
    puuid: undefined,
    error: undefined,
  });
  revalidatePath("/admin");
}

export async function syncNowAction(
  _prev: ActionResult | null,
  // Ignoré : l'action est branchée sur un <form>, qui fournit toujours un
  // FormData. La signature doit le refléter.
  _form?: FormData,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!process.env.RIOT_API_KEY) {
    return {
      ok: false,
      message:
        "RIOT_API_KEY absente : copier .env.example vers .env.local, y coller une clé personnelle, puis relancer le serveur.",
    };
  }
  try {
    const report = await runSync();
    revalidatePath("/admin");
    revalidatePath("/ranking");
    const parts = [
      `${report.calls} appels`,
      `${report.newSamples} relevé(s)`,
      `${report.newGames} partie(s)`,
      `${report.inGame} en jeu`,
    ];
    if (report.errors.length > 0) parts.push(`${report.errors.length} erreur(s)`);
    return { ok: report.errors.length === 0, message: parts.join(" · ") };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function signInAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ok = await signIn(String(form.get("password") ?? ""));
  if (ok) revalidatePath("/admin");
  return ok ? { ok: true } : { ok: false, message: "Mot de passe incorrect." };
}

export async function signOutAction(): Promise<void> {
  await signOut();
  revalidatePath("/admin");
}
