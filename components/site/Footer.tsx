import { Logo } from "./Logo";

export function Footer({ updatedLabel }: { updatedLabel: string }) {
  return (
    <footer className="mt-24 border-t border-hair">
      <div className="shell flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-3">
            Suivi de classement SoloQ pour un plateau de joueurs choisi. Les
            rangs, les parties et les variations de LP sont relevés en continu et
            recalculés à chaque partie terminée.
          </p>
          <p className="num mt-4 text-micro tracking-[0.1em] text-ink-4">
            RELEVÉ · {updatedLabel}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-3">
          <FooterColumn
            title="Classement"
            items={["High elo", "Low elo", "Historique", "Records"]}
          />
          <FooterColumn
            title="Données"
            items={["Riot API", "Data Dragon", "Méthode de calcul", "Statut"]}
          />
          <FooterColumn
            title="Projet"
            items={["À propos", "Journal", "Contact"]}
          />
        </div>
      </div>

      <div className="border-t border-hair">
        <div className="shell flex flex-col gap-2 py-5 text-[0.75rem] text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <p>
            SOLOQ/LADDER n&apos;est ni approuvé par Riot Games ni lié de quelque
            manière que ce soit à Riot Games. League of Legends est une marque
            déposée de Riot Games, Inc.
          </p>
          <p className="num tracking-[0.08em]">© 2026</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="label">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item}>
            <span className="cursor-default text-[0.8125rem] text-ink-3 transition-colors duration-150 hover:text-ink-2">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
