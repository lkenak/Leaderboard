import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Accès à /admin.
 *
 * Le modèle est volontairement minimal — un mot de passe partagé, pas de
 * comptes — parce que le besoin est « mes amis et moi », pas « une plateforme
 * multi-utilisateurs ». Deux règles suffisent :
 *
 *  - `ADMIN_PASSWORD` défini → il faut le fournir une fois, un cookie
 *    `httpOnly` prend le relais ;
 *  - `ADMIN_PASSWORD` absent → la page n'est accessible qu'en développement
 *    local. Sans cette seconde règle, un déploiement sans mot de passe
 *    laisserait n'importe qui modifier le plateau.
 */

const COOKIE = "ladder_admin";

function token(password: string): string {
  return createHash("sha256").update(`ladder:${password}`).digest("hex");
}

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function adminPasswordSet(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function isAdmin(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return process.env.NODE_ENV !== "production";
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  return Boolean(value && sameToken(value, token(password)));
}

/** @returns `true` si le mot de passe était bon. */
export async function signIn(attempt: string): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || attempt !== password) return false;
  const jar = await cookies();
  jar.set(COOKIE, token(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
