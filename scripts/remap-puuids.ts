import { accountByRiotId } from "@/lib/riot/client";
import { getDb } from "@/lib/db/client";
import type { Region } from "@/lib/types";

/**
 * Ré-associe les comptes suivis quand la clé Riot change de **produit**.
 *
 *   npm run riot:remap            # simulation, n'écrit rien
 *   npm run riot:remap -- --apply # applique
 *
 * ## Pourquoi ce script existe
 *
 * Les PUUID renvoyés par Riot sont chiffrés avec la clé qui les a émis. Tant
 * qu'on régénère une clé **du même produit** (une clé de développement par
 * exemple), le chiffrement ne change pas et les PUUID enregistrés restent
 * valides. Passer d'un produit à un autre — développement vers Personal, puis
 * Personal vers Production — les rend **indéchiffrables** :
 *
 *     400 Bad Request - Exception decrypting AvuqBBjcw…
 *
 * Tous les comptes tombent en erreur d'un coup, et rien dans le message ne
 * suggère que la cause est un changement de clé.
 *
 * ## Pourquoi ne pas simplement tout ré-résoudre
 *
 * Mettre les `puuid` à NULL suffirait à faire re-résoudre les comptes au
 * relevé suivant — mais `riot_players` est la clé étrangère de `rank_samples`
 * et de `games`, et `pruneOrphanPlayers()` supprime les joueurs que plus
 * personne ne référence. On perdrait **tout l'historique de LP**, la seule
 * donnée que rien ne peut reconstruire.
 *
 * Ce script résout donc chaque Riot ID avec la clé courante et **déplace**
 * l'historique de l'ancien PUUID vers le nouveau, table par table, dans une
 * seule transaction par compte.
 *
 * ## À relancer
 *
 * À chaque changement de produit de clé. Le jour où la clé Production
 * arrivera, il faudra repasser ici.
 */

const APPLIQUER = process.argv.includes("--apply");

interface Identite {
  region: string;
  game_name: string;
  tag_line: string;
  puuid: string;
}

const db = getDb();

const identites = db
  .prepare<[], Identite>(
    `SELECT DISTINCT region, game_name, tag_line, puuid FROM (
       SELECT region, game_name, tag_line, puuid FROM ladder_members WHERE puuid IS NOT NULL
       UNION
       SELECT region, game_name, tag_line, puuid FROM user_riot_accounts WHERE puuid IS NOT NULL
     ) ORDER BY game_name COLLATE NOCASE`,
  )
  .all();

console.log(
  `${identites.length} compte(s) à vérifier — ` +
    (APPLIQUER ? "MODE RÉEL, la base sera modifiée." : "simulation, aucune écriture."),
);

/** Déplace tout ce qui pend à un PUUID vers un autre. */
function remapper(ancien: string, nouveau: string): void {
  const run = db.transaction(() => {
    // Le nouveau parent d'abord : les clés étrangères sont actives, les
    // enfants ne peuvent pas pointer vers une ligne qui n'existe pas encore.
    db.prepare(
      `INSERT INTO riot_players
         (puuid, region, game_name, tag_line, profile_icon_id, summoner_level,
          peak_absolute_lp, last_error, updated_at)
       SELECT ?, region, game_name, tag_line, profile_icon_id, summoner_level,
              peak_absolute_lp, last_error, updated_at
         FROM riot_players WHERE puuid = ?`,
    ).run(nouveau, ancien);

    for (const table of ["rank_samples", "games", "live_games", "ladder_members", "user_riot_accounts"]) {
      db.prepare(`UPDATE ${table} SET puuid = ? WHERE puuid = ?`).run(nouveau, ancien);
    }

    // L'ancien parent en dernier : plus personne ne le référence.
    db.prepare("DELETE FROM riot_players WHERE puuid = ?").run(ancien);
  });
  run.immediate();
}

function compter(puuid: string): { samples: number; games: number } {
  return {
    samples:
      db.prepare<[string], { c: number }>("SELECT COUNT(*) c FROM rank_samples WHERE puuid = ?").get(puuid)
        ?.c ?? 0,
    games:
      db.prepare<[string], { c: number }>("SELECT COUNT(*) c FROM games WHERE puuid = ?").get(puuid)?.c ??
      0,
  };
}

async function main(): Promise<void> {
  let inchanges = 0;
  let remappes = 0;
  const echecs: string[] = [];

  for (const id of identites) {
    const label = `${id.game_name}#${id.tag_line}`;
    try {
      const dto = await accountByRiotId(id.region as Region, id.game_name, id.tag_line);
      if (!dto) {
        echecs.push(`${label} — Riot ID introuvable sur ${id.region}`);
        continue;
      }

      if (dto.puuid === id.puuid) {
        inchanges++;
        continue;
      }

      const existe = (puuid: string) =>
        Boolean(
          db
            .prepare<[string], { puuid: string }>("SELECT puuid FROM riot_players WHERE puuid = ?")
            .get(puuid),
        );

      // Deux déclarations du même compte à la casse près — « x9Jgl#ff15 » et
      // « x9jgl#ff15 » — partagent le même PUUID et apparaissent deux fois
      // dans la liste, qui a été lue avant la première écriture. Au second
      // passage l'ancien a déjà disparu : c'est fait, pas un échec.
      if (!existe(id.puuid) && existe(dto.puuid)) {
        inchanges++;
        continue;
      }

      const { samples, games } = compter(id.puuid);

      if (existe(dto.puuid)) {
        // Le nouveau PUUID est déjà connu pour un AUTRE compte : fusionner
        // demanderait d'arbitrer deux historiques, ce qui n'a pas de bonne
        // réponse automatique.
        echecs.push(`${label} — le nouveau PUUID existe déjà en base, fusion à faire à la main`);
        continue;
      }

      console.log(
        `  ${label.padEnd(26)} ${id.puuid.slice(0, 12)}… → ${dto.puuid.slice(0, 12)}…  ` +
          `(${samples} relevé(s), ${games} partie(s))`,
      );
      if (APPLIQUER) remapper(id.puuid, dto.puuid);
      remappes++;
    } catch (err) {
      echecs.push(`${label} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\n${remappes} ré-associé(s), ${inchanges} inchangé(s), ${echecs.length} en échec.`,
  );
  for (const e of echecs) console.log(`  échec : ${e}`);

  if (!APPLIQUER && remappes > 0) {
    console.log("\nSimulation : relancer avec --apply pour écrire.");
  }
}

main().catch((err) => {
  console.error("remap-puuids a échoué :", err);
  process.exit(1);
});
