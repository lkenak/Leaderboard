"use client";

import { useActionState } from "react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/app/l/[slug]/settings/actions";

/**
 * La barre « dernier relevé + actualiser », au-dessus du classement.
 *
 * Elle remplace le relevé automatique qui partait à chaque visite. Celui-ci
 * faisait travailler l'API Riot pour des gens qui n'avaient rien demandé, et
 * comme il s'exécutait après l'envoi de la page, son résultat n'apparaissait
 * qu'au chargement suivant — le site donnait l'impression de ne jamais se
 * mettre à jour.
 *
 * Le bouton dit donc deux choses : de quand datent les chiffres affichés, et
 * comment en obtenir de plus frais. L'attente est explicite, parce qu'elle est
 * réelle : quelques secondes pour un ladder déjà résolu, davantage s'il reste
 * des comptes à retrouver chez Riot.
 */
export function RefreshBar({
  updatedLabel,
  action: boundAction,
}: {
  /** « 14:32 », ou `null` quand aucun relevé n'a encore abouti. */
  updatedLabel: string | null;
  action: (prev: ActionResult | null, form?: FormData) => Promise<ActionResult>;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null,
  );

  return (
    <form
      action={action}
      className="flex flex-wrap items-center justify-end gap-3 pb-3"
    >
      {result?.message ? (
        <p
          role="status"
          className={cn("num text-[0.75rem]", result.ok ? "text-acid" : "text-blaze")}
        >
          {result.message}
        </p>
      ) : (
        <p className="label">
          {updatedLabel ? `Relevé de ${updatedLabel}` : "Aucun relevé"}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="num h-8 rounded-sm border border-hair bg-panel-3/60 px-3 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-2 transition-colors duration-150 hover:border-acid/50 hover:text-acid disabled:opacity-50"
      >
        {pending ? "Relevé en cours…" : "Actualiser"}
      </button>
    </form>
  );
}
