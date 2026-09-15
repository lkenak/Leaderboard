import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Produit `.next/standalone`, un dossier autonome contenant le serveur et
   * seulement les dépendances réellement utilisées — quelques dizaines de
   * mégaoctets au lieu des 600 de `node_modules`. C'est ce qu'on copie sur le
   * serveur.
   */
  output: "standalone",

  /**
   * `LADDER_DATA_DIR` (par défaut `.data/`) contient `ladder.sqlite` — la
   * seule donnée que rien ne peut reconstruire (l'historique de LP). Le
   * traçage de Next ne devrait pas l'ouvrir (lu via `better-sqlite3` à
   * l'exécution, jamais au build), mais l'exclure explicitement évite qu'un
   * futur changement n'embarque silencieusement une copie périmée de la base
   * dans la sortie standalone et n'écrase celle du serveur au déploiement
   * suivant.
   */
  outputFileTracingExcludes: {
    "*": [".data/**"],
  },
};

export default nextConfig;
