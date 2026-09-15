"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createLadder } from "@/lib/db/ladders";

export async function createLadderAction(form: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/ladders/new");

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return; // validation minimale ; le champ est `required` côté client

  const ladder = createLadder({ name, ownerUserId: session.user.id });
  revalidatePath("/ladders");
  redirect(`/l/${ladder.slug}/settings`);
}
