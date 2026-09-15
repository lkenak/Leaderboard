"use client";

import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { syncNowAction, type ActionResult } from "@/app/admin/actions";

/**
 * Relève tout le plateau à la demande. L'appel peut durer une minute sur un
 * plateau qui vient d'être créé (chaque compte doit être résolu puis son
 * historique téléchargé), d'où l'état d'attente explicite plutôt qu'un bouton
 * qui semble ne rien faire.
 */
export function SyncButton() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    syncNowAction,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="num h-9 rounded-sm border border-hair bg-panel-3/60 px-4 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-2 transition-colors duration-150 hover:border-acid/50 hover:text-acid disabled:opacity-50"
      >
        {pending ? "Relevé en cours…" : "Relever maintenant"}
      </button>
      {result?.message && (
        <p
          role="status"
          className={cn(
            "num text-[0.75rem]",
            result.ok ? "text-acid" : "text-blaze",
          )}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
