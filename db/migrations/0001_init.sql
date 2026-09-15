-- Schéma initial : utilisateurs Discord, ladders, appartenances, identité Riot
-- dédupliquée par PUUID. Voir lib/db/client.ts pour le runner de migration.
--
-- Principe : séparer l'identité Riot (dédupliquée par PUUID, partagée entre
-- tous les ladders qui la référencent) de l'appartenance (bracket, équipe,
-- streamer — propres à une ligne ladder<->compte). Un compte présent dans
-- deux ladders n'a qu'un seul historique et n'est jamais re-fetché deux fois
-- par la synchronisation Riot.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  discord_id    TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL,
  global_name   TEXT,
  avatar        TEXT,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

-- Le joueur Riot canonique : dédupliqué par PUUID.
CREATE TABLE riot_players (
  puuid             TEXT PRIMARY KEY,
  region             TEXT NOT NULL,
  game_name         TEXT NOT NULL,
  tag_line          TEXT NOT NULL,
  profile_icon_id   INTEGER,
  summoner_level    INTEGER,
  peak_absolute_lp  INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE ladders (
  id            TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_ladders_owner ON ladders(owner_user_id);

-- Appartenance many-to-many ladder <-> compte Riot déclaré. bracket, équipe,
-- rôle forcé, pays sont PAR APPARTENANCE (un même puuid peut être high-elo
-- dans un ladder et low-elo dans un autre).
CREATE TABLE ladder_members (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ladder_id         TEXT NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
  region            TEXT NOT NULL,
  game_name         TEXT NOT NULL,
  tag_line          TEXT NOT NULL,
  puuid             TEXT REFERENCES riot_players(puuid),
  bracket           TEXT NOT NULL CHECK (bracket IN ('high-elo','low-elo')),
  country           TEXT,
  team_name         TEXT,
  team_tag          TEXT,
  streamer_platform TEXT,
  streamer_login    TEXT,
  role_override     TEXT,
  added_by_user_id  TEXT REFERENCES users(id),
  added_at          INTEGER NOT NULL,
  resolve_error     TEXT,
  UNIQUE (ladder_id, region, game_name COLLATE NOCASE, tag_line COLLATE NOCASE)
);
CREATE INDEX idx_ladder_members_ladder ON ladder_members(ladder_id);
CREATE INDEX idx_ladder_members_puuid  ON ladder_members(puuid);

-- « Mes comptes » : déclaration libre par l'utilisateur, sert uniquement à la
-- découverte croisée — aucune vérification de propriété.
CREATE TABLE user_riot_accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region        TEXT NOT NULL,
  game_name     TEXT NOT NULL,
  tag_line      TEXT NOT NULL,
  puuid         TEXT REFERENCES riot_players(puuid),
  resolve_error TEXT,
  added_at      INTEGER NOT NULL,
  UNIQUE (user_id, region, game_name COLLATE NOCASE, tag_line COLLATE NOCASE)
);
CREATE INDEX idx_user_riot_accounts_puuid ON user_riot_accounts(puuid);
CREATE INDEX idx_user_riot_accounts_user  ON user_riot_accounts(user_id);

-- Historique de LP — la donnée irremplaçable, dédupliquée par puuid.
CREATE TABLE rank_samples (
  puuid          TEXT NOT NULL REFERENCES riot_players(puuid) ON DELETE CASCADE,
  ts             INTEGER NOT NULL,
  tier           TEXT NOT NULL,
  division       TEXT,
  league_points  INTEGER NOT NULL,
  absolute_lp    INTEGER NOT NULL,
  wins           INTEGER NOT NULL,
  losses         INTEGER NOT NULL,
  PRIMARY KEY (puuid, ts)
);

CREATE TABLE games (
  puuid         TEXT NOT NULL REFERENCES riot_players(puuid) ON DELETE CASCADE,
  id            TEXT NOT NULL,
  champion_id   TEXT,
  champion_name TEXT,
  role          TEXT,
  win           INTEGER NOT NULL,
  kills         INTEGER,
  deaths        INTEGER,
  assists       INTEGER,
  lp_delta      INTEGER,
  duration_sec  INTEGER,
  ended_at      INTEGER NOT NULL,
  cs            INTEGER,
  vision_score  INTEGER,
  PRIMARY KEY (puuid, id)
);
CREATE INDEX idx_games_puuid_ended ON games(puuid, ended_at DESC);

-- Absence de ligne = pas en partie (remplace Record<puuid, LiveGame|null>).
CREATE TABLE live_games (
  puuid       TEXT PRIMARY KEY REFERENCES riot_players(puuid) ON DELETE CASCADE,
  champion_id TEXT,
  champion_name TEXT,
  role        TEXT,
  started_at  INTEGER NOT NULL
);

CREATE TABLE apex_cutoffs (
  platform    TEXT PRIMARY KEY,
  challenger  INTEGER NOT NULL,
  grandmaster INTEGER NOT NULL,
  fetched_at  INTEGER NOT NULL
);

-- Une seule ligne, remplace StoreShape.lastSync/lastSyncError.
CREATE TABLE sync_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync INTEGER,
  last_sync_error TEXT
);
INSERT INTO sync_meta (id, last_sync, last_sync_error) VALUES (1, NULL, NULL);
