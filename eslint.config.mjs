import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "supabase/functions/**",
    ],
  },
  {
    // La propia regla menciona la marca: este archivo queda fuera.
    ignores: ["eslint.config.mjs"],
    rules: {
      // El nombre comercial vive solo en config/brand.ts.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/Timeline/i]",
          message: "No uses «Timeline»: es una marca registrada de otro juego.",
        },
      ],
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-*", "next", "next/*", "@supabase/*"], message: "El dominio no depende de React, Next ni Supabase." },
          ],
        },
      ],
    },
  },
];

export default config;
