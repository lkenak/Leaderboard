"use client";

import { useActionState } from "react";
import { signInAction, type ActionResult } from "@/app/admin/actions";

export function SignInForm() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="password" className="label">
        Mot de passe d&apos;administration
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className="h-11 rounded-sm border border-hair bg-panel-3/60 px-3 text-[0.9375rem] text-ink transition-colors duration-150 hover:border-hair-2 focus:border-acid/50"
      />
      <button
        type="submit"
        disabled={pending}
        className="num h-11 rounded-sm bg-acid px-5 text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Vérification…" : "Entrer"}
      </button>
      {result?.message && (
        <p role="alert" className="text-[0.8125rem] text-blaze">
          {result.message}
        </p>
      )}
    </form>
  );
}
