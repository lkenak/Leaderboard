/**
 * Migration unique : `.data/store.json` (l'ancien plateau global) → la base
 * SQLite multi-ladder. Tout l'historique de LP part dans **un seul** ladder,
 * possédé par le premier utilisateur connecté via Discord.
 *
 * Usage, depuis le dépôt :
 *   node scripts/migrate-store-to-sqlite.mjs --owner-discord-id=123456789012345678 [--name="Classement"]
 *
 * Prérequis : le nouveau code est déployé, et ce Discord s'est déjà connecté
 * une fois (sa ligne `users` doit exister — ce script ne l'invente pas, il
 * n'a pas son pseudo/avatar).
 *
 * Idempotent par sécurité : refuse de tourner si des ladders existent déjà.
 * `deploy/backup.sh` d'abord, toujours.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=")];
  }),
);

const ownerDiscordId = args["owner-discord-id"];
const ladderName = args.name ?? "Classement";
if (!ownerDiscordId) {
  console.error("Usage : node scripts/migrate-store-to-sqlite.mjs --owner-discord-id=<id> [--name=\"...\"]");
  process.exit(1);
}

const DATA_DIR = process.env.LADDER_DATA_DIR ?? join(process.cwd(), ".data");
const STORE_PATH = join(DATA_DIR, "store.json");
const DB_PATH = join(DATA_DIR, "ladder.sqlite");

if (!existsSync(STORE_PATH)) {
  console.error(`✗ ${STORE_PATH} introuvable — rien à migrer.`);
  process.exit(1);
}
const store = JSON.parse(readFileSync(STORE_PATH, "utf8"));

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Les migrations de schéma (db/migrations/*.sql) sont censées avoir déjà
// tourné au premier démarrage du serveur — ce script échoue proprement sinon,
// plutôt que de recréer un schéma en double.
const hasUsers = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
  .get();
if (!hasUsers) {
  console.error("✗ Schéma absent : démarrer le serveur au moins une fois avant ce script.");
  process.exit(1);
}

const existingLadders = db.prepare("SELECT COUNT(*) AS n FROM ladders").get().n;
if (existingLadders > 0) {
  console.error(`✗ ${existingLadders} ladder(s) existe(nt) déjà — migration déjà faite ? Arrêt par sécurité.`);
  process.exit(1);
}

const owner = db.prepare("SELECT id FROM users WHERE discord_id = ?").get(ownerDiscordId);
if (!owner) {
  console.error(`✗ Aucun utilisateur avec discord_id=${ownerDiscordId}. Se connecter une fois via Discord d'abord.`);
  process.exit(1);
}

console.log(`→ Migration de ${store.roster.length} compte(s) vers le ladder « ${ladderName} »…`);

const ladderId = randomUUID();
const now = Date.now();

const run = db.transaction(() => {
  db.prepare(
    "INSERT INTO ladders (id, owner_user_id, name, slug, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(ladderId, owner.id, ladderName, "classement", now);

  const insertPlayer = db.prepare(
    `INSERT INTO riot_players (puuid, region, game_name, tag_line, profile_icon_id, summoner_level, peak_absolute_lp, last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(puuid) DO NOTHING`,
  );
  const insertMember = db.prepare(
    `INSERT INTO ladder_members
       (ladder_id, region, game_name, tag_line, puuid, country, role_override, added_by_user_id, added_at, resolve_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSample = db.prepare(
    `INSERT OR IGNORE INTO rank_samples (puuid, ts, tier, division, league_points, absolute_lp, wins, losses)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertGame = db.prepare(
    `INSERT OR IGNORE INTO games
       (puuid, id, champion_id, champion_name, role, win, kills, deaths, assists, lp_delta, duration_sec, ended_at, cs, vision_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertLive = db.prepare(
    `INSERT OR REPLACE INTO live_games (puuid, champion_id, champion_name, role, started_at) VALUES (?, ?, ?, ?, ?)`,
  );

  for (const a of store.roster) {
    if (a.puuid) {
      insertPlayer.run(
        a.puuid, a.region, a.gameName, a.tagLine,
        a.profileIconId ?? null, a.summonerLevel ?? null, a.peakAbsoluteLp ?? 0, a.error ?? null, now,
      );
    }
    insertMember.run(
      ladderId, a.region, a.gameName, a.tagLine, a.puuid ?? null,
      a.country ?? null, a.roleOverride ?? null,
      owner.id, a.addedAt, a.puuid ? null : (a.error ?? "Pas encore synchronisé"),
    );

    if (a.puuid) {
      for (const s of store.samples[a.puuid] ?? []) {
        insertSample.run(a.puuid, s.ts, s.tier, s.division, s.leaguePoints, s.absoluteLp, s.wins, s.losses);
      }
      for (const g of store.games[a.puuid] ?? []) {
        insertGame.run(
          a.puuid, g.id, g.championId, g.championName, g.role, g.win ? 1 : 0,
          g.kills, g.deaths, g.assists, g.lpDelta, g.durationSec, g.endedAt, g.cs, g.visionScore,
        );
      }
      const live = store.live[a.puuid];
      if (live) insertLive.run(a.puuid, live.championId, live.championName, live.role, live.startedAt);
    }
  }

  db.prepare("UPDATE sync_meta SET last_sync = ?, last_sync_error = ? WHERE id = 1").run(
    store.lastSync ?? null,
    store.lastSyncError ?? null,
  );
});
run();

// ── Vérification : aucune bascule silencieuse sur une migration incomplète ──
const expectedSamples = Object.values(store.samples ?? {}).reduce((n, s) => n + s.length, 0);
const expectedGames = Object.values(store.games ?? {}).reduce((n, g) => n + g.length, 0);
const actualSamples = db.prepare("SELECT COUNT(*) AS n FROM rank_samples").get().n;
const actualGames = db.prepare("SELECT COUNT(*) AS n FROM games").get().n;
const actualMembers = db.prepare("SELECT COUNT(*) AS n FROM ladder_members WHERE ladder_id = ?").get(ladderId).n;

let ok = true;
if (actualMembers !== store.roster.length) {
  console.error(`✗ Comptes : attendu ${store.roster.length}, obtenu ${actualMembers}`);
  ok = false;
}
if (actualSamples !== expectedSamples) {
  console.error(`✗ Relevés : attendu ${expectedSamples}, obtenu ${actualSamples}`);
  ok = false;
}
if (actualGames !== expectedGames) {
  console.error(`✗ Parties : attendu ${expectedGames}, obtenu ${actualGames}`);
  ok = false;
}

if (!ok) {
  console.error("\n✗ Migration incomplète — store.json n'a PAS été renommé. Corriger avant de relancer.");
  process.exit(1);
}

renameSync(STORE_PATH, `${STORE_PATH}.bak`);
console.log(`✓ ${actualMembers} compte(s), ${actualSamples} relevé(s), ${actualGames} partie(s) migrés.`);
console.log(`✓ Ladder « ${ladderName} » créé (/l/classement), possédé par le compte Discord ${ownerDiscordId}.`);
console.log(`✓ ${STORE_PATH} renommé en ${STORE_PATH}.bak — à garder, à ne pas supprimer.`);
