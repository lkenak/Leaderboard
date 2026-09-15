"use client";

import { useActionState, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { REGIONS } from "@/lib/riot/routing";
import { claimAccountAction } from "@/app/ladders/actions";
import type { ActionResult } from "@/app/l/[slug]/settings/actions";

/**
 * « Mes comptes » : déclarer un Riot ID comme sien, sans preuve de propriété
 * (voir README) — sert uniquement à faire remonter les ladders où ce compte
 * apparaît, même créés par quelqu'un d'autre.
 */
export function ClaimAccountForm() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    claimAccountAction,
    null,
  );
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result?.ok) form.current?.reset();
  }, [result]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="riotId" className="label">
            Riot ID
          </label>
          <input
            id="riotId"
            name="riotId"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="Pseudo#TAG"
            className="mt-2 h-11 w-full rounded-sm border border-hair bg-panel-3/60 px-3 text-[0.9375rem] text-ink transition-colors duration-150 placeholder:text-ink-4 hover:border-hair-2 focus:border-acid/50"
          />
        </div>
        <div className="sm:w-28">
          <label htmlFor="region" className="label">
            Région
          </label>
          <select
            id="region"
            name="region"
            defaultValue="EUW"
            className="mt-2 h-11 w-full rounded-sm border border-hair bg-panel-3/60 px-2.5 text-[0.875rem] text-ink transition-colors duration-150 hover:border-hair-2 focus:border-acid/50"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="num h-11 rounded-sm bg-acid px-5 text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter,opacity] duration-150 hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>

      {result?.message && (
        <p
          role="status"
          className={cn(
            "rounded-sm border px-3 py-2.5 text-[0.8125rem]",
            result.ok ? "border-acid/40 bg-acid/8 text-acid" : "border-blaze/40 bg-blaze/8 text-blaze",
          )}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
