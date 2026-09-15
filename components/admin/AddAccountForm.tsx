"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { roleLabel } from "@/lib/lol";
import { ROLES } from "@/lib/types";
import { REGIONS } from "@/lib/riot/routing";
import { addAccountAction, type ActionResult } from "@/app/admin/actions";

/**
 * Le formulaire d'ajout.
 *
 * Un seul champ compte vraiment : le Riot ID. Tout le reste a une valeur par
 * défaut utilisable et vit sous un dépliant, parce que le geste courant est
 * « je colle un pseudo et j'appuie sur Entrée » — pas « je remplis huit
 * champs ». Le poste principal, notamment, est déduit des parties : le forcer
 * n'a d'intérêt que pour un joueur qui change de rôle en cours de split.
 */
export function AddAccountForm() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    addAccountAction,
    null,
  );
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  // Le champ est vidé après un succès, pour enchaîner les ajouts au clavier.
  // Dans un effet et non pendant le rendu : `reset()` touche le DOM.
  useEffect(() => {
    if (result?.ok) form.current?.reset();
  }, [result]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
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

        <div className="sm:w-36">
          <label htmlFor="bracket" className="label">
            Sélection
          </label>
          <select
            id="bracket"
            name="bracket"
            defaultValue="high-elo"
            className="mt-2 h-11 w-full rounded-sm border border-hair bg-panel-3/60 px-2.5 text-[0.875rem] text-ink transition-colors duration-150 hover:border-hair-2 focus:border-acid/50"
          >
            <option value="high-elo">High elo</option>
            <option value="low-elo">Low elo</option>
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="label self-start transition-colors duration-150 hover:text-ink-2"
      >
        {open ? "− " : "+ "}
        Détails facultatifs
      </button>

      {open && (
        <div className="grid gap-3 rounded-sm border border-hair bg-panel-2/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Pays (ISO 2 lettres)" htmlFor="country">
            <input
              id="country"
              name="country"
              maxLength={2}
              placeholder="FR"
              className="input"
            />
          </Field>
          <Field label="Équipe" htmlFor="teamName">
            <input id="teamName" name="teamName" placeholder="Voltaic" className="input" />
          </Field>
          <Field label="Tag d'équipe" htmlFor="teamTag">
            <input id="teamTag" name="teamTag" maxLength={4} placeholder="VLT" className="input" />
          </Field>
          <Field label="Poste forcé" htmlFor="role">
            <select id="role" name="role" defaultValue="" className="input">
              <option value="">Déduit des parties</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plateforme de stream" htmlFor="streamPlatform">
            <select id="streamPlatform" name="streamPlatform" defaultValue="" className="input">
              <option value="">Aucune</option>
              <option value="twitch">Twitch</option>
              <option value="kick">Kick</option>
              <option value="youtube">YouTube</option>
            </select>
          </Field>
          <Field label="Identifiant de chaîne" htmlFor="streamLogin">
            <input id="streamLogin" name="streamLogin" placeholder="pseudo" className="input" />
          </Field>
        </div>
      )}

      {result?.message && (
        <p
          role="status"
          className={cn(
            "rounded-sm border px-3 py-2.5 text-[0.8125rem]",
            result.ok
              ? "border-acid/40 bg-acid/8 text-acid"
              : "border-blaze/40 bg-blaze/8 text-blaze",
          )}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label text-[0.5625rem]">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
