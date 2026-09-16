import { auth } from "@/lib/auth";
import { laddersForUser } from "@/lib/db/users";
import type { HeaderLadder, HeaderUser } from "@/components/site/Header";

/**
 * Ce que l'en-tête a besoin de savoir, sur n'importe quelle page : qui est
 * connecté, et quels ladders lui proposer dans le sélecteur. Regroupé ici pour
 * qu'une page n'ait pas à répéter l'appel à `auth()` puis la requête des
 * ladders — et pour que le sélecteur soit identique partout.
 *
 * Aucun appel réseau : une lecture de cookie signé et deux requêtes SQLite
 * locales.
 */
export interface HeaderContext {
  /** `null` quand personne n'est connecté (pages publiques). */
  user: HeaderUser | null;
  /** Notre id interne (`users.id`), pas l'id Discord. */
  userId: string | null;
  ladders: HeaderLadder[];
}

export async function headerContext(): Promise<HeaderContext> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!session?.user || !userId) return { user: null, userId: null, ladders: [] };

  const { owned, appearingIn } = laddersForUser(userId);
  return {
    user: {
      name: session.user.name ?? "Discord",
      avatar: session.user.image ?? null,
    },
    userId,
    ladders: [...owned, ...appearingIn].map((l) => ({
      slug: l.slug,
      name: l.name,
      owned: l.ownerUserId === userId,
    })),
  };
}
