import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

/**
 * Garde centralisée pour tout ce qui suppose une session : créer/gérer ses
 * ladders. La vue publique d'un ladder (`/l/[slug]`) n'est PAS gardée ici —
 * tous les ladders sont publics. Chaque Server Action de `settings/actions.ts`
 * revérifie quand même la propriété (défense en profondeur, comme l'ancien
 * `guard()` de `app/admin/actions.ts`) : un middleware seul ne protège pas un
 * appel Server Action direct après mise en cache côté client.
 *
 * Importe `auth.config.ts` (sans accès disque) et non `lib/auth.ts` : le
 * middleware tourne dans l'Edge Runtime, qui ne peut pas charger le module
 * natif `better-sqlite3` tiré par les callbacks `jwt`/`session` complets.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/ladders", "/ladders/:path*"],
};
