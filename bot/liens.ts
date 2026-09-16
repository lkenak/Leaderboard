import { getUserByDiscordId, listClaimedAccounts, type ClaimedAccount, type UserRecord } from "@/lib/db/users";
import type { Region } from "@/lib/types";

/**
 * Le pont entre une identité Discord et un compte de jeu.
 *
 * Il est déjà entièrement construit sans qu'on ait rien à ajouter : le site se
 * connecte en OAuth Discord, donc `users.discord_id` contient le snowflake de
 * la personne qui tape la commande. Aucun parcours de liaison à inventer,
 * aucune table de correspondance.
 *
 * Le travail de ce module est ailleurs : **distinguer les états dégradés**.
 * « Introuvable » est une mauvaise réponse — selon le cas, la personne doit se
 * connecter au site, déclarer un compte Riot, en désigner un principal, ou
 * simplement attendre le prochain relevé. Quatre actions différentes, qui
 * méritent quatre messages différents. La base sait déjà lequel s'applique :
 * `user_riot_accounts.resolve_error` et `riot_players.last_error` sont remplis
 * par la synchronisation précisément pour ça.
 */

export type EtatLien =
  /** Pas encore connecté au site : rien ne rattache ce Discord à un compte. */
  | { etat: "aucun-compte" }
  /** Compte sur le site, mais aucun Riot ID déclaré. */
  | { etat: "aucun-compte-riot"; utilisateur: UserRecord }
  /**
   * Un Riot ID principal est déclaré, mais la synchronisation ne l'a pas
   * encore résolu en PUUID — ou n'y arrive pas, et le dit.
   */
  | { etat: "non-resolu"; utilisateur: UserRecord; compte: ClaimedAccount }
  /** Tout est en place : on peut parler de ce joueur. */
  | { etat: "prêt"; utilisateur: UserRecord; compte: ClaimedAccount; puuid: string };

/**
 * Le compte principal parmi ceux déclarés.
 *
 * `is_main` est tenu par le code et non par une contrainte (migration 0003),
 * donc on se garde de supposer qu'il y en a exactement un : à défaut de
 * principal explicite, le plus ancien fait l'affaire — c'est la même règle que
 * `unclaimRiotAccount` applique quand le principal disparaît.
 */
function comptePrincipal(comptes: ClaimedAccount[]): ClaimedAccount | null {
  if (comptes.length === 0) return null;
  return (
    comptes.find((c) => c.isMain) ??
    [...comptes].sort((a, b) => a.addedAt - b.addedAt)[0]
  );
}

export function resoudre(discordId: string): EtatLien {
  const utilisateur = getUserByDiscordId(discordId);
  if (!utilisateur) return { etat: "aucun-compte" };

  const compte = comptePrincipal(listClaimedAccounts(utilisateur.id));
  if (!compte) return { etat: "aucun-compte-riot", utilisateur };
  if (!compte.puuid) return { etat: "non-resolu", utilisateur, compte };

  return { etat: "prêt", utilisateur, compte, puuid: compte.puuid };
}

/** Le Riot ID lisible, pour les messages. */
export function labelCompte(compte: ClaimedAccount): string {
  return `${compte.gameName}#${compte.tagLine}`;
}

/** La région, typée — la base la stocke en texte libre. */
export function regionDe(compte: ClaimedAccount): Region {
  return compte.region as Region;
}

/**
 * Le message à renvoyer quand on ne peut pas parler d'un joueur.
 *
 * `soi` change la formulation : expliquer à quelqu'un ce qu'il doit faire, ou
 * expliquer pourquoi on ne sait rien de quelqu'un d'autre, ce n'est pas le
 * même texte — et dans le second cas, envoyer la personne sur `/profil` ne
 * sert à rien.
 */
export function messageEtat(lien: EtatLien, publicUrl: string, soi: boolean): string {
  const qui = soi ? "Tu n'as" : "Cette personne n'a";

  switch (lien.etat) {
    case "aucun-compte":
      return soi
        ? `Tu n'as pas encore de compte ici. Connecte-toi une fois sur ${publicUrl}/login — ` +
            "c'est le même compte Discord, le lien se fait tout seul."
        : "Cette personne ne s'est jamais connectée au site, je ne sais donc pas " +
            "quel compte de jeu est le sien.";

    case "aucun-compte-riot":
      return soi
        ? `${qui} déclaré aucun compte Riot. Ajoute ton Riot ID sur ${publicUrl}/profil ` +
            "et marque-le comme principal — c'est celui que j'utiliserai pour te représenter."
        : `${qui} déclaré aucun compte Riot sur le site.`;

    case "non-resolu": {
      const label = labelCompte(lien.compte);
      const erreur = lien.compte.resolveError;
      if (erreur) {
        return (
          `**${label}** n'a pas pu être retrouvé chez Riot : ${erreur}\n` +
          (soi ? `Corrige le Riot ID sur ${publicUrl}/profil.` : "")
        ).trim();
      }
      return (
        `**${label}** est déclaré mais pas encore relevé. ` +
        "Le prochain relevé s'en charge, d'ici quelques minutes."
      );
    }

    case "prêt":
      // Appelé à tort : l'appelant devrait afficher la fiche.
      return "Tout est en place.";
  }
}
