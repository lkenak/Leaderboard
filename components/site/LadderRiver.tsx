import { Crest } from "@/components/ui/Crest";
import { cn } from "@/lib/cn";
import type { Tier } from "@/lib/types";

/**
 * Le décor de la page d'accueil : des lignes de classement qui dérivent en
 * diagonale derrière le titre.
 *
 * La page ne disait que ce que le produit *fait*, avec des mots. On comprend
 * plus vite en voyant à quoi ça ressemble — d'où ces vraies lignes de
 * classement, avec leurs blasons, leurs LP et leurs séries, plutôt qu'une
 * illustration abstraite.
 *
 * Trois règles de tenue :
 *
 *  - **c'est un décor, pas du contenu.** `aria-hidden` et
 *    `pointer-events-none` : un lecteur d'écran n'a rien à y lire, et rien
 *    n'y est cliquable. Le texte du titre reste seul à porter le sens.
 *  - **les joueurs sont fictifs, et ça se vérifie.** Personne n'a demandé à
 *    figurer sur une page d'accueil publique. La première version de ce
 *    fichier affichait douze vrais comptes du plateau : des pseudos
 *    « inventés » de bonne foi, mais repris sans le savoir à la base. Un
 *    pseudo plausible n'est pas un pseudo libre — avant d'ajouter un nom ici,
 *    le confronter à `riot_players.game_name` et `ladder_members.game_name`.
 *  - **le mouvement s'arrête** pour qui a désactivé les animations —
 *    `globals.css` neutralise toutes les animations sous
 *    `prefers-reduced-motion`, celles-ci comprises.
 *
 * Le défilement réutilise `@keyframes ticker`, qui translate de 0 à -50 % :
 * il suffit de dupliquer la bande pour que la boucle soit invisible.
 */

interface Ligne {
  position: number;
  nom: string;
  tier: Tier;
  division: string | null;
  lp: number;
  delta: number;
  forme: boolean[];
}

/**
 * Des classements crédibles : des paliers variés, des séries contrastées, des
 * écarts de LP réalistes. Un décor où tout le monde est Challenger à +50 LP
 * ne ressemblerait à aucune soirée de SoloQ.
 */
const BANDES: Ligne[][] = [
  [
    { position: 1, nom: "Cassoulet Diff", tier: "DIAMOND", division: "II", lp: 74, delta: 24, forme: [true, true, false, true, true] },
    { position: 2, nom: "Pingouin Vertical", tier: "EMERALD", division: "I", lp: 12, delta: -17, forme: [false, true, false, false, true] },
    { position: 3, nom: "Mamie Ashe", tier: "EMERALD", division: "III", lp: 55, delta: 8, forme: [true, false, true, true, false] },
    { position: 4, nom: "Tartiflette OTP", tier: "PLATINUM", division: "I", lp: 91, delta: 31, forme: [true, true, true, false, true] },
    { position: 5, nom: "Chaussette Gauche", tier: "PLATINUM", division: "IV", lp: 8, delta: -12, forme: [false, false, true, false, false] },
  ],
  [
    { position: 1, nom: "Jungle Sans Permis", tier: "MASTER", division: null, lp: 312, delta: 42, forme: [true, true, true, true, false] },
    { position: 2, nom: "Yordle Fiscal", tier: "DIAMOND", division: "IV", lp: 37, delta: -21, forme: [false, true, false, true, false] },
    { position: 3, nom: "Panique En Bot", tier: "GOLD", division: "II", lp: 64, delta: 15, forme: [true, false, true, true, true] },
    { position: 4, nom: "Ctrl Alt Suppr", tier: "SILVER", division: "I", lp: 43, delta: -9, forme: [false, false, true, false, true] },
    { position: 5, nom: "Le Stagiaire", tier: "BRONZE", division: "III", lp: 27, delta: 11, forme: [true, true, false, false, true] },
  ],
  [
    { position: 1, nom: "Raclette 2000", tier: "GRANDMASTER", division: null, lp: 641, delta: 18, forme: [true, true, false, true, true] },
    { position: 2, nom: "Bilan Comptable", tier: "DIAMOND", division: "I", lp: 88, delta: -6, forme: [true, false, false, true, false] },
    { position: 3, nom: "Trente Deux Ping", tier: "PLATINUM", division: "II", lp: 19, delta: 27, forme: [true, true, true, false, false] },
    { position: 4, nom: "Sieste Tactique", tier: "IRON", division: "IV", lp: 4, delta: -14, forme: [false, false, false, true, false] },
    { position: 5, nom: "Fromage Qui Pue", tier: "GOLD", division: "IV", lp: 71, delta: 22, forme: [false, true, true, true, false] },
  ],
];

/**
 * Les plans, du plus net au plus lointain.
 *
 * Les vitesses sont toutes différentes et volontairement non multiples :
 * deux bandes qui se recalent périodiquement se voient immédiatement, et le
 * décor cesse d'avoir l'air vivant.
 */
const PLANS = [
  { opacite: 0.34, flou: 1, duree: "88s" },
  { opacite: 0.46, flou: 0.5, duree: "121s" },
  { opacite: 0.28, flou: 1.6, duree: "97s" },
  { opacite: 0.40, flou: 0.8, duree: "143s" },
  { opacite: 0.22, flou: 2.2, duree: "109s" },
  { opacite: 0.32, flou: 1.3, duree: "167s" },
];

function LigneFantome({ l }: { l: Ligne }) {
  return (
    <div className="flex w-[22rem] shrink-0 items-center gap-3 rounded-md border border-hair-2 bg-panel-2 px-4 py-3">
      <span
        className={cn(
          "num flex size-6 shrink-0 items-center justify-center rounded-xs text-[0.6875rem] font-semibold",
          l.position === 1 ? "bg-acid text-acid-ink" : "text-ink-3",
        )}
      >
        {l.position}
      </span>

      <span className="grid size-7 shrink-0 place-items-center rounded-xs bg-panel-3 text-[0.6875rem] font-semibold text-ink-3">
        {l.nom.slice(0, 1).toUpperCase()}
      </span>

      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
        {l.nom}
      </span>

      <Crest tier={l.tier} size={20} />
      <span className="num shrink-0 text-[0.75rem] font-semibold text-ink tabular-nums">
        {l.lp}
        <span className="ml-0.5 text-[0.625rem] font-normal text-ink-4">LP</span>
      </span>

      <span
        className={cn(
          "num shrink-0 text-[0.6875rem] font-semibold tabular-nums",
          l.delta > 0 ? "text-acid" : "text-blaze",
        )}
      >
        {l.delta > 0 ? "+" : "−"}
        {Math.abs(l.delta)}
      </span>

      {/* La forme : victoire haute et acide, défaite basse et brasier. La
          silhouette se lit avant la couleur. */}
      <span className="flex shrink-0 items-end gap-[3px]">
        {l.forme.map((v, i) => (
          <span
            key={i}
            className={cn("w-[3px] rounded-[1px]", v ? "h-3 bg-acid" : "h-1.5 bg-blaze")}
          />
        ))}
      </span>
    </div>
  );
}

/** Une bande, dupliquée pour que la boucle du `ticker` soit invisible. */
function Bande({
  lignes,
  duree,
  inverse,
}: {
  lignes: Ligne[];
  duree: string;
  inverse?: boolean;
}) {
  return (
    /* Le masque porte sur ce conteneur-ci, de largeur finie. Posé sur la
       piste `w-max`, le dégradé se serait étalé sur plusieurs milliers de
       pixels et les bords n'auraient jamais fondu à l'écran. */
    <div className="fade-x w-full overflow-hidden">
      <div
        className="animate-ticker flex w-max gap-4 pr-4"
        style={{
          animationDuration: duree,
          animationDirection: inverse ? "reverse" : undefined,
          // La piste devient sa propre couche : sans ça, le navigateur
          // recalcule le flou du parent à chaque image.
          willChange: "transform",
        }}
      >
        {/* Quatre copies, soit deux moitiés identiques : `ticker` translate de
            -50 %, donc la boucle retombe exactement sur une répétition. */}
        {[...lignes, ...lignes, ...lignes, ...lignes].map((l, i) => (
          <LigneFantome key={i} l={l} />
        ))}
      </div>
    </div>
  );
}

export function LadderRiver() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* La diagonale. Une seule rotation sur le groupe, des bandes plus
          larges que l'écran pour qu'aucun angle ne montre un bord, et assez
          de bandes pour que la traversée se lise d'un coin à l'autre — avec
          trois, ce n'était qu'une tache au milieu. */}
      <div className="absolute top-1/2 left-1/2 flex w-[210%] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] flex-col gap-5">
        {PLANS.map((plan, i) => (
          <div key={i} style={{ opacity: plan.opacite, filter: `blur(${plan.flou}px)` }}>
            <Bande
              lignes={BANDES[i % BANDES.length]}
              duree={plan.duree}
              inverse={i % 2 === 1}
            />
          </div>
        ))}
      </div>

      {/* Voile. Sur grand écran, dense à gauche pour que le titre garde son
          contraste et presque absent à droite pour laisser respirer le décor :
          c'est ce déséquilibre qui fait lire la page de gauche à droite.
          En dessous de `md` le texte occupe toute la largeur, donc un voile
          horizontal n'épargnerait rien — il se contenterait d'effacer la
          rivière. Il devient vertical : dense sous le titre, plus clair dans
          le vide qui suit le bouton, là où le décor a de la place. */}
      <div className="absolute inset-0 bg-gradient-to-b from-base/90 via-base/75 to-base/45 md:bg-gradient-to-r md:from-base md:via-base/90 md:to-base/25" />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-base to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-base" />
    </div>
  );
}
