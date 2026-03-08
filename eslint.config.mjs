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
      // Flags `useEffect(() => setState(true), [])` as problematic, but this pattern
      // is the standard Next.js hydration guard — run-once on mount, no cascading renders.
      "react-hooks/set-state-in-effect": "off",
      // Allow _ prefix convention for intentionally unused variables/params/errors.
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
    // Test files use `as any` for mock data and tool.execute calls —
    // relaxing this rule avoids noisy errors without compromising production types.
    files: ["src/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
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
