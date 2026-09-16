import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Base SQLite embarquée.
 *
 * Un seul fichier, dans le même dossier que l'ancien `store.json`
 * (`LADDER_DATA_DIR`, `.data/` en dev, `/var/lib/leaderboard` en prod) : même
 * séparation build/données, même chemin inscriptible côté systemd
 * (`ReadWritePaths`).
 *
 * Les migrations (`db/migrations/*.sql`) sont lues depuis `process.cwd()` —
 * `next dev`/`next build` tournent depuis la racine du dépôt, et en
 * production `deploy/deploy.sh` copie `db/` dans `/srv/leaderboard/current`
 * pour la même raison qu'il copie déjà `.next/static` et `public/` : la
 * sortie standalone de Next ne trace que le code JS importé, jamais un
 * dossier lu à l'exécution via `fs`.
 */

const DATA_DIR = process.env.LADDER_DATA_DIR ?? join(process.cwd(), ".data");
const DB_PATH = join(DATA_DIR, "ladder.sqlite");
const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

let instance: Database.Database | null = null;
let migrationsEnabled = true;

/**
 * À appeler avant le premier `getDb()`, et seulement par le bot Discord.
 *
 * Exactement **un** processus doit jouer les migrations : c'est le serveur
 * Next, au démarrage (`instrumentation.ts`). Le bot s'attache à une base déjà
 * migrée. Deux raisons, pas une :
 *
 *  - deux `migrate()` concurrents au redémarrage du déploiement peuvent entrer
 *    dans la transaction du même fichier ;
 *  - le bot tourne depuis le dépôt, donc son `db/migrations` est celui du
 *    commit tout juste tiré, alors que le site sert peut-être encore le
 *    précédent. Le laisser migrer, c'est laisser le bot pousser un schéma en
 *    avance sur le code qui répond aux visiteurs.
 *
 * Elle lève plutôt que de se taire si la base est déjà ouverte : un futur
 * module qui appellerait `getDb()` à l'import ferait sinon de cet appel un
 * no-op invisible, et le bot migrerait quand même.
 */
export function disableMigrations(): void {
  if (instance) {
    throw new Error(
      "disableMigrations() appelé après getDb() : la base est déjà ouverte et migrée.",
    );
  }
  migrationsEnabled = false;
}

function migrate(db: Database.Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((r) => (r as { version: string }).version),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(file, Date.now());
    });
    run();
    console.log(`[db] migration appliquée : ${file}`);
  }
}

export function getDb(): Database.Database {
  if (instance) return instance;

  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  // WAL : un writer (la synchro Riot) et des lecteurs (chaque rendu de page)
  // en permanence — sans WAL, le mode rollback-journal par défaut sérialise
  // complètement lecteurs et écrivains, et un rendu de page attendrait
  // derrière un cycle de synchro de plusieurs secondes.
  db.pragma("journal_mode = WAL");
  // 10 s et non 5 : depuis le bot Discord, deux processus écrivent dans ce
  // fichier. Les écritures du bot sont courtes, celles de la synchro Riot
  // peuvent tenir plusieurs secondes — c'est derrière celles-là qu'on attend.
  db.pragma("busy_timeout = 10000");
  db.pragma("foreign_keys = ON");

  if (migrationsEnabled) migrate(db);

  instance = db;
  return db;
}

/** Pour les scripts one-shot (migration, tests) qui ouvrent un fichier précis. */
export function openDbAt(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 10000");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}
