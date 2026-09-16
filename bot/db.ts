import { disableMigrations, getDb } from "@/lib/db/client";

/**
 * Ouverture de la base côté bot.
 *
 * Le bot lit le **même fichier SQLite** que le serveur web, et réutilise
 * `lib/db/*` et `lib/riot/snapshot.ts` tels quels — aucun de ces modules
 * n'appelle `getDb()` au niveau module, ce qui laisse à ce fichier le temps
 * de désactiver les migrations avant la première ouverture.
 *
 * Deux règles tiennent cette cohabitation :
 *
 *  1. **Un seul migrateur.** C'est le serveur web, au démarrage
 *     (`instrumentation.ts`). Le bot s'attache à une base déjà migrée.
 *  2. **Aucun appel à l'API Riot depuis ce processus.** Le limiteur de débit
 *     de `lib/riot/client.ts` est en mémoire et par processus : un second
 *     appelant doublerait le débit sans que rien ne le voie. Une règle ESLint
 *     sur `bot/**` refuse ces imports.
 */

/**
 * La migration la plus récente dont ce code a besoin.
 *
 * À relever dans le même commit que chaque migration dont le bot dépend.
 * Aujourd'hui `0005` : les tables des parties personnalisées.
 */
export const MIGRATION_MINIMALE = "0005_pp_sessions.sql";

export interface EtatSchema {
  appliquees: string[];
  enAvance: string[];
}

/**
 * Ouvre la base, ou sort en échec si le schéma est en retard.
 *
 * Sortir plutôt que démarrer en mode dégradé : `deploy.sh` redémarre le
 * service web (qui migre) avant le bot, et systemd relance le bot toutes les
 * 5 s. Un schéma en retard se résorbe donc tout seul en quelques secondes,
 * sans alerte à traiter. Un bot qui démarrerait quand même échouerait à la
 * première commande, plus tard et moins lisiblement.
 */
export function ouvrirBase(): EtatSchema {
  disableMigrations();
  const db = getDb();

  const appliquees = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all()
    .map((r) => (r as { version: string }).version);

  if (!appliquees.includes(MIGRATION_MINIMALE)) {
    console.error(
      `[bot] schéma en retard : ${MIGRATION_MINIMALE} n'est pas appliquée.\n` +
        `      C'est le service web qui migre, à son démarrage. Nouvelle tentative dans 5 s.`,
    );
    process.exit(1);
  }

  // Schéma en avance sur ce code : les migrations d'ici sont additives, on
  // continue — mais on le dit, parce que c'est le symptôme d'un bot redémarré
  // sur l'ancien commit.
  const enAvance = appliquees.filter((v) => v > MIGRATION_MINIMALE);
  if (enAvance.length > 0) {
    console.warn(`[bot] schéma en avance sur ce code : ${enAvance.join(", ")}`);
  }

  return { appliquees, enAvance };
}
