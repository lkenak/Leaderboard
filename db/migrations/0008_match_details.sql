-- Détail complet d'une partie : scoreboard des 10 joueurs, build, runes,
-- courbe d'or. Voir lib/riot/match-details.ts et lib/db/match-details.ts.
--
-- `matches` est un cache PARTAGÉ, à l'échelle de la plateforme et non d'un
-- puuid ou d'un ladder : un lobby joué par cinq membres d'un même ladder (ou
-- par des comptes de deux ladders différents) ne doit être fetché et stocké
-- qu'une seule fois, même principe de déduplication que riot_players pour un
-- compte suivi par deux ladders.
--
-- Seules les 5 parties les plus récentes de chaque puuid suivi reçoivent ce
-- détail (lib/riot/sync.ts) : demander l'historique complet à ce niveau de
-- détail multiplierait par dix le coût d'un cycle pour un usage qui ne
-- concerne qu'un coup d'œil occasionnel sur une partie récente.
CREATE TABLE matches (
  id            TEXT PRIMARY KEY,          -- matchId Riot (ex. EUW1_1234567890)
  queue_id      INTEGER NOT NULL,
  game_version  TEXT NOT NULL,
  duration_sec  INTEGER NOT NULL,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER NOT NULL,
  -- JSON : [[minute, or équipe 100, or équipe 200], ...], un point par minute
  -- (pas des frames Riot). Stocké tel quel : c'est un tracé, jamais filtré en
  -- SQL, comme lp_history ne l'est pas non plus côté vues.
  gold_timeline TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

-- 10 lignes par match. Pas de clé étrangère vers riot_players : 9 des 10
-- participants d'un match sont typiquement des comptes jamais suivis par
-- aucun ladder.
CREATE TABLE match_participants (
  match_id       TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL,          -- 1..10, clé de jointure avec gold_timeline
  puuid          TEXT NOT NULL,
  game_name      TEXT NOT NULL,
  tag_line       TEXT NOT NULL,
  team_id        INTEGER NOT NULL,          -- 100 ou 200
  champion_id    TEXT NOT NULL,
  champion_name  TEXT NOT NULL,
  role           TEXT NOT NULL,
  win            INTEGER NOT NULL,
  kills          INTEGER NOT NULL,
  deaths         INTEGER NOT NULL,
  assists        INTEGER NOT NULL,
  cs             INTEGER NOT NULL,
  vision_score   INTEGER NOT NULL,
  champ_level    INTEGER NOT NULL,
  gold_earned    INTEGER NOT NULL,
  damage_dealt   INTEGER NOT NULL,
  damage_taken   INTEGER NOT NULL,
  summoner1_id   INTEGER NOT NULL,
  summoner2_id   INTEGER NOT NULL,
  -- JSON : items0..6 dans l'ordre Riot (trinket inclus), et
  -- {primaryStyle, subStyle, selections: number[6], shards: number[3]}.
  -- Affichés tels quels (une liste d'icônes) : aucune requête n'a jamais
  -- besoin de filtrer "qui a pris tel objet".
  items_json     TEXT NOT NULL,
  perks_json     TEXT NOT NULL,
  PRIMARY KEY (match_id, participant_id)
);
CREATE INDEX idx_match_participants_puuid ON match_participants(puuid);
