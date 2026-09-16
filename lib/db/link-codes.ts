import { randomInt } from "node:crypto";
import { getDb } from "./client";
import type { LadderRecord } from "./ladders";

/**
 * Codes de liaison : le consentement des deux parties, quand ce ne sont pas
 * les mêmes personnes.
 *
 * Relier un ladder à un serveur touche deux domaines d'autorité — le ladder,
 * qui appartient à quelqu'un, et le serveur, qui appartient à quelqu'un
 * d'autre. Tant qu'on exigeait les deux **sur la même personne**, ça ne
 * marchait que chez soi : sur le serveur d'un ami, l'administrateur n'est pas
 * le propriétaire du ladder, et le propriétaire n'est pas administrateur. Le
 * bot y restait muet, sans recours.
 *
 * Le code découple les deux gestes sans affaiblir aucun des deux : le
 * propriétaire le génère depuis les réglages de son ladder, l'administrateur
 * le saisit dans `/ladder lier`. Chacun agit dans son domaine, et aucun n'a
 * besoin des droits de l'autre.
 *
 * Usage unique et durée de vie courte : un code qui traîne dans une
 * conversation ne doit pas rester une clé.
 */

/** 30 minutes : le temps de copier un code et de le coller dans Discord. */
export const DUREE_CODE_MS = 30 * 60_000;

/**
 * Alphabet sans caractères confondables (ni O/0, ni I/1/L) : ces codes se
 * lisent à voix haute et se retapent à la main.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function engendrer(): string {
  const bloc = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${bloc()}-${bloc()}`;
}

export interface LinkCode {
  code: string;
  ladderId: string;
  createdByUserId: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
  usedGuildId: string | null;
}

interface Row {
  code: string;
  ladder_id: string;
  created_by_user_id: string;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_guild_id: string | null;
}

function fromRow(r: Row): LinkCode {
  return {
    code: r.code,
    ladderId: r.ladder_id,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    usedGuildId: r.used_guild_id,
  };
}

/** Normalise une saisie : casse, espaces et tiret sont sans importance. */
export function normaliserCode(saisie: string): string {
  const brut = saisie.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return brut.length === 8 ? `${brut.slice(0, 4)}-${brut.slice(4)}` : brut;
}

/**
 * Crée un code pour ce ladder, en invalidant les précédents.
 *
 * Un seul code vivant à la fois : deux codes valides pour le même ladder ne
 * servent à rien et doublent la surface d'un code qui aurait fuité.
 */
export function createLinkCode(ladderId: string, userId: string): LinkCode {
  const db = getDb();
  const maintenant = Date.now();
  let cree: LinkCode | null = null;

  const run = db.transaction(() => {
    db.prepare(
      "DELETE FROM ladder_link_codes WHERE ladder_id = ? AND used_at IS NULL",
    ).run(ladderId);

    // Collision quasi impossible (31^8), mais une clé primaire ne pardonne
    // pas : on réessaie plutôt que de lever au visage de l'utilisateur.
    for (let essai = 0; essai < 5; essai++) {
      const code = engendrer();
      const deja = db
        .prepare("SELECT 1 FROM ladder_link_codes WHERE code = ?")
        .get(code);
      if (deja) continue;

      db.prepare(
        `INSERT INTO ladder_link_codes
           (code, ladder_id, created_by_user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(code, ladderId, userId, maintenant, maintenant + DUREE_CODE_MS);

      cree = {
        code,
        ladderId,
        createdByUserId: userId,
        createdAt: maintenant,
        expiresAt: maintenant + DUREE_CODE_MS,
        usedAt: null,
        usedGuildId: null,
      };
      return;
    }
  });
  run.immediate();

  if (!cree) throw new Error("Impossible d'engendrer un code de liaison.");
  return cree;
}

/** Le code encore valide de ce ladder, s'il y en a un. */
export function currentLinkCode(ladderId: string): LinkCode | null {
  const row = getDb()
    .prepare<[string, number], Row>(
      `SELECT * FROM ladder_link_codes
        WHERE ladder_id = ? AND used_at IS NULL AND expires_at > ?
        ORDER BY created_at DESC LIMIT 1`,
    )
    .get(ladderId, Date.now());
  return row ? fromRow(row) : null;
}

export type ResultatConsommation =
  | { ok: true; ladder: LadderRecord }
  | { ok: false; raison: "inconnu" | "expiré" | "déjà-utilisé" | "ladder-supprimé" };

/**
 * Consomme un code au profit d'un serveur.
 *
 * Marque le code utilisé **dans la même transaction** que sa vérification :
 * deux administrateurs qui colleraient le même code en même temps ne doivent
 * pas réussir tous les deux.
 */
export function consumeLinkCode(code: string, guildId: string): ResultatConsommation {
  const db = getDb();
  const normalise = normaliserCode(code);
  let resultat: ResultatConsommation = { ok: false, raison: "inconnu" };

  const run = db.transaction(() => {
    const row = db
      .prepare<[string], Row>("SELECT * FROM ladder_link_codes WHERE code = ?")
      .get(normalise);
    if (!row) return;

    if (row.used_at !== null) {
      resultat = { ok: false, raison: "déjà-utilisé" };
      return;
    }
    if (row.expires_at <= Date.now()) {
      resultat = { ok: false, raison: "expiré" };
      return;
    }

    const ladder = db
      .prepare<[string], LadderRow>("SELECT * FROM ladders WHERE id = ?")
      .get(row.ladder_id);
    if (!ladder) {
      resultat = { ok: false, raison: "ladder-supprimé" };
      return;
    }

    db.prepare(
      "UPDATE ladder_link_codes SET used_at = ?, used_guild_id = ? WHERE code = ?",
    ).run(Date.now(), guildId, normalise);

    resultat = {
      ok: true,
      ladder: {
        id: ladder.id,
        ownerUserId: ladder.owner_user_id,
        name: ladder.name,
        slug: ladder.slug,
        createdAt: ladder.created_at,
      },
    };
  });
  run.immediate();

  return resultat;
}

interface LadderRow {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  created_at: number;
}
