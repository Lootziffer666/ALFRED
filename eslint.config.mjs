import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, unmodified third-party asset (see public/sql-js/README.md) — not our source.
    "public/sql-js/**",
  ]),
  {
    rules: {
      // Ein führender Unterstrich ist im Repo die Ansage "absichtlich ungenutzt"
      // (Signatur-Platzhalter, dokumentierende Parameternamen, ignorierte
      // Destrukturierungsfelder). Ohne diese Regel meldet der Linter genau die
      // Stellen, an denen die Absicht bereits im Namen steht.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
