-- Mode d'annonce des parties, par liaison serveur↔ladder.
--
-- Jusqu'ici, un salon de comptes rendus recevait une carte par partie classée,
-- sans autre porte de sortie que délier le salon. À deux joueurs actifs c'est
-- confortable ; à douze membres un soir de semaine, c'est une centaine de
-- messages et quelqu'un coupe le salon.
--
-- Le mode est porté par la **liaison** et non par le ladder : deux serveurs
-- peuvent suivre le même ladder sans vouloir le même débit, et c'est déjà la
-- raison pour laquelle `report_channel_id` vit ici.
--
-- `resume-soiree` n'utilise pas la file `game_events` : celle-ci est consommée
-- événement par événement et son marquage « traité » est global, alors qu'un
-- même événement peut viser un salon en annonce immédiate et un autre en
-- résumé. Le résumé se calcule donc depuis `games`, entre `last_digest_at` et
-- la fin de la dernière partie — une borne qui n'a besoin que d'un entier.
ALTER TABLE ladder_discord_guilds
  ADD COLUMN report_mode TEXT NOT NULL DEFAULT 'chaque-partie'
  CHECK (report_mode IN ('chaque-partie', 'resume-soiree'));

-- Dernière partie déjà couverte par un résumé. NULL = aucun résumé envoyé ;
-- le premier ne remontera pas plus loin que sa propre fenêtre d'amorçage,
-- pour ne pas déverser la veille dans le salon au moment du basculement.
ALTER TABLE ladder_discord_guilds
  ADD COLUMN last_digest_at INTEGER;
