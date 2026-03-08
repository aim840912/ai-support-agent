import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // react-hooks/error-boundaries flags try/catch+JSX as a pattern to avoid.
    // This is a false positive for Next.js Server Components — data fetching wrapped
    // in try/catch and returning JSX is the correct, recommended Next.js pattern.
    // Error boundaries apply to Client Component trees, not Server Component renders.
    rules: {
      "react-hooks/error-boundaries": "off",
    },
  },
  prettier, // Must be last — disables ESLint rules that conflict with Prettier
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files should never be linted
    "src/generated/**",
  ]),
]);

export default eslintConfig;
