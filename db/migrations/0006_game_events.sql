-- File d'attente des parties terminées, à destination du bot Discord.
--
-- Pourquoi une table et non un appel direct de la synchro vers le bot : les
-- deux processus partagent déjà ce fichier, la synchronisation Riot est déjà
-- une écriture SQLite, et une ligne survit au redémarrage du bot — un
-- déploiement, un plantage, une coupure de Discord. Un appel perdu ne se
-- rattrape qu'en réimplémentant une file, c'est-à-dire cette table, mais
-- côté bot et sans durabilité.
--
-- L'écriture se fait dans la **même transaction** que l'enregistrement de la
-- partie (`upsertGamesAndEnqueue`). Un plantage entre les deux perdrait la
-- partie pour toujours : au cycle suivant elle serait déjà connue, donc
-- absente des « nouvelles », et plus rien ne la signalerait.
--
-- Pas de clé étrangère vers `games` : la rétention n'en garde que 40 par
-- compte (`lib/riot/retention.ts`), et une partie peut légitimement
-- disparaître avant d'avoir été postée. Le bot traite alors l'événement comme
-- caduc. La clé étrangère vers `riot_players`, elle, fait le ménage toute
-- seule quand un compte quitte son dernier ladder.
CREATE TABLE game_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  puuid        TEXT NOT NULL REFERENCES riot_players(puuid) ON DELETE CASCADE,
  match_id     TEXT NOT NULL,
  ended_at     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  -- NULL tant que le bot n'a rien fait. Renseigné après un envoi réussi OU un
  -- abandon définitif (tentatives épuisées, partie caduque, aucun salon) :
  -- une ligne traitée ne revient jamais.
  processed_at INTEGER,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  UNIQUE (puuid, match_id)
);

-- Le bot balaie toutes les 30 s : il ne doit lire que ce qui attend, jamais
-- tout l'historique.
CREATE INDEX idx_game_events_en_attente ON game_events(created_at)
  WHERE processed_at IS NULL;

-- Idempotence de l'envoi : une carte par partie ET par salon.
--
-- La clé n'inclut volontairement pas le PUUID. Un `match_id` est unique à
-- l'échelle d'une plateforme, et cinq membres d'un même ladder qui jouent
-- ensemble produisent cinq lignes dans `game_events` pour UNE partie : sans
-- cette clé, le salon recevrait cinq cartes identiques.
--
-- Protocole : le bot insère ici en `ON CONFLICT DO NOTHING` **avant**
-- d'envoyer. Zéro ligne affectée signifie « déjà posté » — il édite alors le
-- message existant pour y ajouter le joueur manquant, au lieu d'en poster un
-- second. Si l'envoi échoue, il supprime la ligne qu'il vient d'insérer,
-- sinon la réservation bloquerait à jamais la nouvelle tentative.
CREATE TABLE discord_game_posts (
  channel_id TEXT NOT NULL,
  match_id   TEXT NOT NULL,
  guild_id   TEXT NOT NULL,
  -- SET NULL et non CASCADE : la trace de l'envoi doit survivre à la
  -- suppression du ladder, sinon un ladder recréé avec le même salon
  -- reposterait tout ce qui reste en file.
  ladder_id  TEXT REFERENCES ladders(id) ON DELETE SET NULL,
  message_id TEXT,
  sent_at    INTEGER NOT NULL,
  PRIMARY KEY (channel_id, match_id)
);
