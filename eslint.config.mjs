import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Global ignores — must be a standalone object with only `ignores`
  {
    ignores: ["**/.next/**", "next-env.d.ts", "tmp/**", ".kilo/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-img-element": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: [
      "scripts/**/*.js",
      "scripts/**/*.cjs",
      "scripts/**/*.mjs",
      "*.cjs",
      "shims/**/*.js",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Test files — relax rules that don't apply in test contexts
  {
    files: ["__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@next/next/no-img-element": "off",
    },
  },
  // Scripts — relax any/unused-vars for one-off DB scripts
  {
    files: ["scripts/**/*.{ts,mjs,js}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Config files — allow anonymous default exports
  {
    files: ["postcss.config.mjs", "vitest.config.ts"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
  // Shims — allow require and unused vars (stubs by design)
  {
    files: ["shims/**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default eslintConfig;
