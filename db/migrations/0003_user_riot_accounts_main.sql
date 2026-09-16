-- Compte Riot « principal » parmi ceux qu'un utilisateur déclare comme siens.
--
-- Pourquoi : un joueur déclare volontiers plusieurs comptes (smurf, compte
-- d'une autre région), mais le futur bot Discord doit relier un utilisateur à
-- UN seul compte de jeu — sinon « le rang de @Ike » n'a pas de réponse. Le
-- reste du site continue d'utiliser tous les comptes déclarés (découverte
-- croisée : on veut apparaître dans les ladders de tous ses comptes).
--
-- L'unicité (un seul principal par utilisateur) est tenue par le code, pas
-- par une contrainte : SQLite ne sait pas exprimer « au plus un vrai par
-- groupe » sans index partiel sur une colonne nullable, et
-- `setMainRiotAccount` remet les autres à 0 dans la même transaction.
ALTER TABLE user_riot_accounts ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0;

-- Comptes déjà déclarés avant cette migration : le plus ancien de chaque
-- utilisateur devient son principal, pour que personne ne se retrouve sans.
UPDATE user_riot_accounts SET is_main = 1
WHERE id IN (SELECT MIN(id) FROM user_riot_accounts GROUP BY user_id);
