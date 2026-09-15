import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";

/**
 * Partie de la config Auth.js sans aucun accès disque (`better-sqlite3`),
 * utilisée par `middleware.ts` — qui tourne dans l'Edge Runtime et ne peut
 * pas charger un module natif. `lib/auth.ts` réutilise cette config et y
 * ajoute les callbacks `jwt`/`session` qui, eux, touchent la base : c'est le
 * découpage recommandé par Auth.js pour ce cas précis.
 */
export const authConfig: NextAuthConfig = {
  providers: [Discord],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
};
