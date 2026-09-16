import { getUserByDiscordId, type UserRecord } from "@/lib/db/users";

/**
 * Le pont entre une identité Discord et un compte du site.
 *
 * Il est déjà entièrement construit sans qu'on ait rien à ajouter : le site
 * se connecte en OAuth Discord, donc `users.discord_id` contient le snowflake
 * de la personne qui tape la commande. Aucun parcours de liaison, aucune
 * table de correspondance.
 *
 * Ce module sert surtout à **distinguer les états dégradés**. « Introuvable »
 * est une mauvaise réponse : selon le cas, la personne doit se connecter au
 * site, déclarer un compte Riot, ou simplement attendre le prochain relevé —
 * trois actions différentes, qui méritent trois messages différents.
 */

export type EtatLien =
  | { etat: "lié"; utilisateur: UserRecord }
  | { etat: "aucun-compte" };

export function resoudreUtilisateur(discordId: string): EtatLien {
  const utilisateur = getUserByDiscordId(discordId);
  return utilisateur ? { etat: "lié", utilisateur } : { etat: "aucun-compte" };
}

/** Le message à renvoyer à quelqu'un qui n'a pas encore de compte sur le site. */
export function messageAucunCompte(publicUrl: string): string {
  return (
    "Tu n'as pas encore de compte ici. Connecte-toi une fois sur " +
    `${publicUrl}/login — c'est le même compte Discord, le lien se fait tout seul.`
  );
}
