"use client";

import { useActionState } from "react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/app/l/[slug]/settings/actions";

/**
 * Bouton d'action de réglages : il déclenche, il attend, il rend compte.
 *
 * L'état d'attente est explicite parce que l'attente est réelle — un relevé
 * peut durer plusieurs secondes sur un plateau qui vient d'être créé, chaque
 * compte devant être résolu puis son historique téléchargé. Un bouton qui
 * semble ne rien faire pousse à cliquer trois fois.
 *
 * Les libellés sont paramétrables : c'est le même geste pour relever un
 * plateau ou engendrer un code de liaison, et deux composants jumeaux pour
 * cette seule différence n'auraient rien apporté.
 */
export function SyncButton({
  action: boundAction,
  label = "Relever maintenant",
  pendingLabel = "Relevé en cours…",
}: {
  action: (prev: ActionResult | null, form?: FormData) => Promise<ActionResult>;
  label?: string;
  pendingLabel?: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="num h-9 rounded-sm border border-hair bg-panel-3/60 px-4 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-2 transition-colors duration-150 hover:border-acid/50 hover:text-acid disabled:opacity-50"
      >
        {pending ? pendingLabel : label}
      </button>
      {result?.message && (
        <p
          role="status"
          className={cn(
            "num text-[0.75rem] break-words",
            result.ok ? "text-acid" : "text-blaze",
          )}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
