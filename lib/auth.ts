import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import { authConfig } from "@/lib/auth.config";
import { findOrCreateUserByDiscord } from "@/lib/db/users";

type AppJwt = JWT & { userId?: string };

/**
 * Authentification complète (route handler, pages, Server Actions) : reprend
 * `authConfig` et y ajoute les callbacks qui touchent la base — c'est ce qui
 * rend ce module incompatible avec l'Edge Runtime, et pourquoi
 * `middleware.ts` importe `lib/auth.config.ts` directement plutôt que ce
 * fichier.
 *
 * Pas d'Adapter Auth.js (`@auth/*-adapter`) : son schéma générique
 * (users/accounts/sessions/verification_tokens) est pensé pour supporter
 * n'importe quel provider, alors qu'il n'y en a qu'un ici. À la place, le
 * callback `jwt()` fait l'upsert lui-même dans **notre** table `users`
 * (`lib/db/users.ts`) — une seule base, un seul schéma qu'on maîtrise
 * entièrement, à l'image de l'ancien cookie fait main de `lib/admin.ts`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, profile }) {
      const t = token as AppJwt;
      if (profile) {
        const user = findOrCreateUserByDiscord({
          id: profile.id as string,
          username: (profile.username as string) ?? (profile.global_name as string) ?? "Discord",
          globalName: (profile.global_name as string) ?? null,
          avatar: profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null,
        });
        t.userId = user.id;
      }
      return t;
    },
    async session({ session, token }) {
      const userId = (token as AppJwt).userId;
      if (session.user && userId) {
        session.user.id = userId;
      }
      return session;
    },
  },
});
