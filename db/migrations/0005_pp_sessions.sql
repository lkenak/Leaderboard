-- Parties personnalisées, reprises du bot « Organisation PP ».
--
-- Le principe ne change pas : une feuille d'inscription qui vit dans un
-- message Discord, avec une file d'attente et un tirage d'équipes. Ce qui
-- change, c'est d'où vient le rang — l'ancien bot le demandait dans un menu
-- déroulant et le croyait sur parole, alors que ce projet le mesure déjà.
--
-- Cinq écarts volontaires avec le schéma d'origine :
--
--  1. Horodatages en **millisecondes epoch**, comme partout ailleurs ici, et
--     non en TEXT `datetime('now')`. L'ancien comparait des chaînes UTC à une
--     heure construite en local : tout était décalé d'une ou deux heures selon
--     la saison, en silence.
--  2. `guild_id` porté par la session — ce bot est multi-serveur.
--  3. Les participants sont identifiés par leur **snowflake Discord**, pas par
--     `users.id` : rejoindre une PP ne doit pas exiger d'avoir un compte sur le
--     site. Le lien vers `users` se fait à la lecture, via `users.discord_id`
--     (unique depuis 0001) — inutile de le figer ici, quelqu'un peut créer son
--     compte après avoir rejoint.
--  4. Paliers et rôles reprennent les valeurs de `lib/types.ts`
--     (MIDDLE/BOTTOM/UTILITY, et non MID/BOT/SUPPORT) pour qu'un profil
--     déclaré et un `rank_samples` mesuré soient comparables sans table de
--     correspondance.
--  5. `starts_at` peut être NULL : une heure incomprise ne doit pas empêcher
--     de créer la PP, elle la prive seulement de son rappel.
CREATE TABLE pp_sessions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id             TEXT NOT NULL,
  channel_id           TEXT NOT NULL,
  message_id           TEXT,
  organizer_discord_id TEXT NOT NULL,
  -- Libellés tels que saisis, pour réafficher exactement ce que
  -- l'organisateur a tapé (« 21h30 », « demain »).
  heure_label          TEXT NOT NULL,
  date_label           TEXT NOT NULL,
  starts_at            INTEGER,
  format               TEXT NOT NULL CHECK (format IN ('BO1','BO3','BO5')),
  mode                 TEXT NOT NULL CHECK (mode IN ('NORMAL','FEARLESS','ARAM_MAYHEM')),
  max_players          INTEGER NOT NULL DEFAULT 10,
  status               TEXT NOT NULL DEFAULT 'OPEN'
                         CHECK (status IN ('OPEN','FULL','CANCELLED')),
  reminder_sent        INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL
);

CREATE INDEX idx_pp_sessions_guild ON pp_sessions(guild_id, created_at DESC);

-- Le balayage des rappels tourne toutes les 30 s : il ne doit lire que les
-- sessions encore en attente, jamais tout l'historique.
CREATE INDEX idx_pp_sessions_rappel ON pp_sessions(starts_at)
  WHERE reminder_sent = 0 AND status <> 'CANCELLED';

CREATE TABLE pp_participants (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      INTEGER NOT NULL REFERENCES pp_sessions(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  status          TEXT NOT NULL
                    CHECK (status IN ('PARTICIPANT','WAITLIST','UNAVAILABLE')),
  updated_at      INTEGER NOT NULL,
  UNIQUE (session_id, discord_user_id)
);

-- La promotion depuis la file d'attente sert le plus ancien inscrit d'abord.
-- En millisecondes, contrairement à l'ancien `datetime('now')` qui avait une
-- résolution d'une seconde : deux clics simultanés s'y départageaient au
-- hasard.
CREATE INDEX idx_pp_participants_file ON pp_participants(session_id, status, updated_at);

-- Profil auto-déclaré — un REPLI, et seulement ça.
--
-- Quand le joueur a un compte Riot lié et relevé (users.discord_id ->
-- user_riot_accounts.is_main -> rank_samples), `bot/pp/equipes.ts` utilise le
-- rang **mesuré** et le poste **observé**, et cette table est ignorée. Elle ne
-- sert qu'à ceux qui n'ont pas lié de compte : sans elle ils compteraient pour
-- zéro dans l'équilibrage, ce qui est pire qu'une déclaration approximative.
--
-- Aucune vérification, exactement comme « mes comptes » côté site (0001).
CREATE TABLE pp_profiles (
  discord_user_id TEXT PRIMARY KEY,
  tier            TEXT NOT NULL,
  -- 'NA' pour les paliers sans division (Master et au-dessus).
  division        TEXT NOT NULL,
  main_role       TEXT NOT NULL,
  secondary_role  TEXT NOT NULL,
  updated_at      INTEGER NOT NULL
);
