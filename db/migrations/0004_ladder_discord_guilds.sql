-- Liaison entre un ladder du site et un serveur Discord.
--
-- Cardinalité : N ↔ N, et non « un serveur, un ladder ».
--   - Un même ladder est légitimement suivi par plusieurs serveurs (celui de
--     l'équipe, et celui plus large de la communauté). Forcer l'unicité sur
--     guild_id obligerait à créer un ladder par serveur, donc à suivre deux
--     fois les mêmes comptes Riot : exactement ce que la déduplication par
--     PUUID de 0001 existe pour éviter.
--   - Un même serveur suit parfois deux ladders (la SoloQ principale, celle
--     des smurfs).
-- Ce qui doit être unique, c'est le couple : lier deux fois le même ladder au
-- même serveur ferait partir chaque rapport de fin de partie en double.
--
-- `is_default` reprend le motif de `user_riot_accounts.is_main` (0003) : c'est
-- le ladder que `/classement` sans argument affiche dans ce serveur. Comme
-- pour `is_main`, l'unicité est tenue par le code dans la même transaction que
-- l'insertion — SQLite ne sait pas exprimer « au plus un vrai par groupe ».
CREATE TABLE ladder_discord_guilds (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ladder_id         TEXT NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
  guild_id          TEXT NOT NULL,
  -- Salon des rapports de fin de partie (lot 4). NULL = liaison active pour
  -- la consultation, mais aucun envoi spontané. C'est aussi l'état dans lequel
  -- le bot se remet lui-même après un 50013 (permissions retirées) plutôt que
  -- de réessayer indéfiniment — l'ancien bot « Organisation PP » bouclait
  -- là-dessus, son journal en est plein.
  report_channel_id TEXT,
  report_error      TEXT,
  is_default        INTEGER NOT NULL DEFAULT 0,
  -- Qui a lié, pour que `/ladder etat` puisse répondre « lié par X le JJ/MM »
  -- sans avoir à fouiller un journal.
  added_by_user_id  TEXT REFERENCES users(id),
  created_at        INTEGER NOT NULL,
  UNIQUE (ladder_id, guild_id)
);

CREATE INDEX idx_ladder_discord_guilds_guild ON ladder_discord_guilds(guild_id);
CREATE INDEX idx_ladder_discord_guilds_ladder ON ladder_discord_guilds(ladder_id);

-- Code de liaison à usage unique.
--
-- Cas nominal : le propriétaire du ladder est aussi administrateur du serveur,
-- et `/ladder lier` vérifie les deux directement. Ce n'est pas toujours vrai —
-- un ladder tenu par un joueur, un serveur tenu par quelqu'un d'autre. Le code
-- permet aux deux parties de consentir sans partager de compte : le
-- propriétaire le génère depuis /l/<slug>/settings, l'administrateur le passe
-- à `/ladder lier code:<code>`.
--
-- Table créée maintenant bien que le parcours ne soit branché qu'au lot
-- suivant : une migration de plus pour six colonnes n'apporte rien, et l'avoir
-- là évite de re-trancher la question au moment de l'écrire.
CREATE TABLE ladder_link_codes (
  code               TEXT PRIMARY KEY,
  ladder_id          TEXT NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL,
  -- Renseignés à la consommation : un code ne sert qu'une fois.
  used_at            INTEGER,
  used_guild_id      TEXT
);
