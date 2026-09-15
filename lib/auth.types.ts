import type { DefaultSession } from "next-auth";

// L'augmentation du module `next-auth/jwt` échoue sous
// `moduleResolution: "bundler"` (TS2664 malgré une résolution normale par
// ailleurs) — `token.userId` est donc typé par cast local dans lib/auth.ts
// plutôt que par augmentation d'interface.
declare module "next-auth" {
  interface Session {
    user: {
      /** Notre id interne (`users.id`), pas l'id Discord. */
      id: string;
    } & DefaultSession["user"];
  }
}
