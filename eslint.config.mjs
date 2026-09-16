import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Les Server Actions imposent leur signature : `useActionState` passe
      // toujours l'état précédent, et `<form action>` toujours un FormData,
      // même quand l'action n'en a pas besoin. Le préfixe `_` dit « ignoré
      // volontairement » plutôt que de faire disparaître le paramètre.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Les cartes Discord sont dessinées par satori, pas par un navigateur :
    // `next/image` n'y existe pas, et `<img>` y est le seul élément d'image
    // possible. Il n'y a ni LCP ni bande passante à optimiser — le résultat
    // est un PNG rendu sur le serveur.
    files: ["lib/cards/**/*.tsx", "app/api/internal/cards/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    // Le bot Discord tourne dans son propre processus, sur la même base.
    //
    // Le limiteur de débit de `lib/riot/client.ts` est une instance de module,
    // en mémoire : un second processus qui appellerait l'API Riot ne le verrait
    // pas et doublerait le débit en silence — jusqu'au 429, puis au bannissement
    // temporaire de la clé. Le bot lit la base, et quand il lui faut des données
    // fraîches il déclenche `POST /api/refresh` (voir `bot/web.ts`), qui passe
    // par le limiteur du serveur Next.
    files: ["bot/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/riot/client",
                "@/lib/riot/sync",
                "@/lib/riot/refresh",
              ],
              message:
                "Le bot n'appelle jamais l'API Riot : le limiteur est en mémoire " +
                "et par processus, un second appelant double le débit en silence. " +
                "Passer par POST /api/refresh (bot/web.ts).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Répertoire de travail de Claude Code : ce n'est pas du code du projet,
    // et les worktrees qu'il contient faisaient remonter 5 600 faux positifs.
    ".claude/**",
    ".data/**",
  ]),
]);

export default eslintConfig;
