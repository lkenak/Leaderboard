import { absoluteLp, rankShort } from "@/lib/lol";
import { listGames, listSamples } from "@/lib/db/riot-players";
import { getProfile } from "@/lib/db/pp";
import type { Role, Tier } from "@/lib/types";
import { resoudre } from "../liens";

/**
 * Ce qu'on sait d'un participant à une PP, et d'où on le sait.
 *
 * Deux sources, dans cet ordre :
 *
 *  1. **Le compte Riot lié**, quand il existe et qu'il a été relevé. Le rang
 *     vient de `rank_samples`, le poste de l'historique des parties. C'est
 *     mesuré, ça n'est pas discutable, et ça n'a rien demandé au joueur.
 *  2. **Le profil auto-déclaré** (`pp_profiles`), sinon. Approximatif, mais
 *     largement préférable à compter quelqu'un pour zéro dans l'équilibrage.
 *
 * C'est le seul vrai bénéfice de la liaison de comptes pour les PP, et la
 * raison pour laquelle on n'a pas simplement porté l'ancienne table telle
 * quelle.
 */

export type SourceRang = "mesuré" | "déclaré" | "inconnu";

export interface JoueurPp {
  discordUserId: string;
  source: SourceRang;
  tier: Tier | null;
  /** Division en chiffres romains, `null` en apex ou si le rang est inconnu. */
  division: string | null;
  /** `null` pour un rang déclaré : personne ne déclare ses LP. */
  leaguePoints: number | null;
  /** Libellé court (« E2 », « P3 ») pour les textes, `null` si inconnu. */
  rangCourt: string | null;
  /** Échelle continue tous paliers confondus — la clé de l'équilibrage. */
  absoluteLp: number;
  mainRole: Role | null;
  secondaryRole: Role | null;
}

/** Le plus joué sur l'historique conservé. */
function posteDominant(puuid: string): Role | null {
  const parties = listGames(puuid);
  if (parties.length === 0) return null;
  const compte = new Map<Role, number>();
  for (const g of parties) compte.set(g.role, (compte.get(g.role) ?? 0) + 1);
  return [...compte.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function resoudreJoueur(discordUserId: string): JoueurPp {
  const lien = resoudre(discordUserId);

  if (lien.etat === "prêt") {
    const releve = listSamples(lien.puuid).at(-1);
    if (releve) {
      const rank = {
        tier: releve.tier,
        division: releve.division,
        leaguePoints: releve.leaguePoints,
        wins: releve.wins,
        losses: releve.losses,
      };
      return {
        discordUserId,
        source: "mesuré",
        tier: releve.tier,
        division: releve.division,
        leaguePoints: releve.leaguePoints,
        rangCourt: rankShort(rank),
        absoluteLp: absoluteLp(rank),
        mainRole: posteDominant(lien.puuid),
        secondaryRole: null,
      };
    }
  }

  const profil = getProfile(discordUserId);
  if (profil) {
    // Une division déclarée « NA » (paliers apex) se lit comme un I : c'est
    // le haut du palier, ce que `absoluteLp` attend de toute façon.
    const rank = {
      tier: profil.tier,
      division: profil.division === "NA" ? null : profil.division,
      leaguePoints: 0,
      wins: 0,
      losses: 0,
    };
    return {
      discordUserId,
      source: "déclaré",
      tier: profil.tier,
      division: profil.division === "NA" ? null : profil.division,
      leaguePoints: null,
      rangCourt: rankShort(rank),
      absoluteLp: absoluteLp(rank),
      mainRole: profil.mainRole,
      secondaryRole: profil.secondaryRole,
    };
  }

  return {
    discordUserId,
    source: "inconnu",
    tier: null,
    division: null,
    leaguePoints: null,
    rangCourt: null,
    absoluteLp: 0,
    mainRole: null,
    secondaryRole: null,
  };
}
