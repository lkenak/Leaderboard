/**
 * Exécuté une fois au démarrage du serveur Next, avant la première requête.
 *
 * Seul rôle : faire passer `fetch` par le proxy d'entreprise quand il y en a
 * un. `fetch` de Node repose sur undici, qui — contrairement à curl — **ignore
 * `HTTP_PROXY` / `HTTPS_PROXY`**. Sans ce branchement, tous les appels à l'API
 * Riot depuis un poste derrière un proxy échouent en `UND_ERR_CONNECT_TIMEOUT`,
 * ce qui ressemble à une panne de Riot alors que c'est le réseau local.
 *
 * `EnvHttpProxyAgent` lit `HTTP_PROXY`, `HTTPS_PROXY` et `NO_PROXY`. Sans ces
 * variables — en production sur Vercel, par exemple — il se comporte comme le
 * répartiteur par défaut : ce fichier est donc sans effet là où il n'est pas
 * nécessaire, et il n'y a pas deux chemins de code à maintenir.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Ouvre la base (et applique les migrations en attente) une fois pour
  // toutes, avant la première requête — pas au fil des rendus de page.
  const { getDb } = await import("@/lib/db/client");
  getDb();

  if (!process.env.HTTP_PROXY && !process.env.HTTPS_PROXY) return;

  const { setGlobalDispatcher, EnvHttpProxyAgent } = await import("undici");
  setGlobalDispatcher(new EnvHttpProxyAgent());
  console.log(
    `[réseau] fetch routé via le proxy ${process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY}`,
  );
}
