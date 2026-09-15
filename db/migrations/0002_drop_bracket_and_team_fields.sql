-- Retire le split high-elo/low-elo (hérité de soloqchallenge.gg, pensé pour
-- un classement régional) et les champs équipe/streamer (contexte esport
-- organisé) : sans intérêt pour un ladder d'une vingtaine d'amis, où tout le
-- monde est dans un seul classement. Retire aussi la coupe apex
-- (Challenger/GM), qui n'a de sens qu'à l'échelle d'une région entière.
ALTER TABLE ladder_members DROP COLUMN bracket;
ALTER TABLE ladder_members DROP COLUMN team_name;
ALTER TABLE ladder_members DROP COLUMN team_tag;
ALTER TABLE ladder_members DROP COLUMN streamer_platform;
ALTER TABLE ladder_members DROP COLUMN streamer_login;
DROP TABLE apex_cutoffs;
