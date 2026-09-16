import type { LadderCardModel } from "./models";
import { deltaLabel, stampLabel } from "./models";

/**
 * Le mode dégradé : le même modèle, rendu en embed Discord.
 *
 * Il n'est pas décoratif, il est **obligatoire**. Le bot lit la base
 * directement mais dépend du serveur web pour l'image ; un redémarrage du
 * site, un rendu trop lent, et `/classement` doit quand même répondre. Une
 * commande qui renvoie « erreur » parce qu'une image n'a pas voulu se
 * dessiner est une régression, pas un incident acceptable.
 *
 * On produit un objet compatible `EmbedBuilder` (la forme JSON attendue par
 * l'API Discord) plutôt qu'un `EmbedBuilder` : ce fichier vit dans `lib/`,
 * partagé avec le site, et ne doit pas importer discord.js.
 */

export interface EmbedCompatible {
  title: string;
  /** Absent plutôt que relatif : une URL non absolue fait rejeter l'embed. */
  url?: string;
  description: string;
  color: number;
  footer: { text: string };
}

/** `#e9ff1f`, la couleur acide de la charte, en entier — ce qu'attend Discord. */
const ACID = 0xe9ff1f;

export function ladderFallbackEmbed(model: LadderCardModel): EmbedCompatible {
  const description =
    model.rows.length === 0
      ? "_Aucun joueur classé pour l'instant._"
      : model.rows
          .map((r) => {
            const live = r.live ? " · 🔴 en jeu" : "";
            return (
              `\`${String(r.position).padStart(2, " ")}\` **${r.name}** — ` +
              `${r.rankShort} ${r.leaguePoints} LP · ${r.winrate} % · ` +
              `${deltaLabel(r.sessionLp, " LP")} sur 24 h${live}`
            );
          })
          .join("\n");

  const reste =
    model.total > model.rows.length
      ? ` · ${model.total - model.rows.length} joueur(s) de plus sur le site`
      : "";

  return {
    title: model.ladderName,
    ...(model.url ? { url: model.url } : {}),
    description,
    color: ACID,
    footer: { text: `Relevé du ${stampLabel(model.updatedAt)} · ${model.splitName}${reste}` },
  };
}
