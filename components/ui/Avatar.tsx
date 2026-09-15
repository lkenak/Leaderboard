"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { profileIconSrc } from "@/lib/lol";
import { Flag } from "./Flag";

/**
 * Icône de profil d'un joueur, avec son drapeau en pastille.
 *
 * `<img>` et non `next/image` : la source est distante, minuscule, et son
 * identifiant est arbitraire (le compte réel du joueur), donc l'optimiseur
 * n'aurait rien à optimiser et ferait un aller-retour serveur par icône. Le
 * repli couvre le cas d'un identifiant retiré d'un patch à l'autre.
 */
export function Avatar({
  profileIconId,
  name,
  country,
  size = 34,
  live = false,
  className,
}: {
  profileIconId: number | undefined;
  name: string;
  country?: string;
  size?: number;
  live?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const flagWidth = Math.max(12, Math.round(size * 0.41));

  return (
    <span className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {profileIconId !== undefined && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profileIconSrc(profileIconId)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            "rounded-sm bg-panel-3 object-cover",
            live ? "ring-1 ring-acid/70" : "ring-1 ring-hair",
          )}
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "num grid place-items-center rounded-sm bg-panel-3 font-semibold text-ink-3",
            live ? "ring-1 ring-acid/70" : "ring-1 ring-hair",
          )}
          style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      {country && (
        <Flag
          code={country}
          width={flagWidth}
          className="absolute -right-1 -bottom-[3px] ring-[2.5px] ring-panel"
        />
      )}
    </span>
  );
}
