"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithDiscord(): Promise<void> {
  await signIn("discord");
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
