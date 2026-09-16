import { NextResponse, type NextRequest } from "next/server";

/**
 * Garde des routes `/api/internal/*`.
 *
 * Même motif que `app/api/refresh/route.ts`, et **le même secret** : les deux
 * points d'entrée ne sont appelés que de 127.0.0.1 vers 127.0.0.1, par un
 * processus qui tourne déjà sur la machine où vit la base. Deux secrets, ce
 * serait deux rotations pour aucune séparation utile.
 *
 * Seconde ligne de défense seulement : côté production, Caddy répond 404 sur
 * `/api/internal/*` avant même d'atteindre Next.
 */
export function refuseNonAutorise(request: NextRequest): NextResponse | null {
  const secret = process.env.REFRESH_SECRET;

  if (secret) {
    const header = request.headers.get("authorization");
    const viaQuery = request.nextUrl.searchParams.get("secret");
    if (header !== `Bearer ${secret}` && viaQuery !== secret) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
    return null;
  }

  // Pas de secret configuré : ouvert en développement, fermé en production —
  // un oubli de configuration ne doit pas ouvrir la route sur le monde.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "REFRESH_SECRET non configuré." }, { status: 401 });
  }
  return null;
}
