import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      
      // ═══════════════════════════════════════════════════════════════
      // MADISON STUDIO - BRAND CONSISTENCY RULES
      // Reference: src/design/tokens.ts
      // ═══════════════════════════════════════════════════════════════
      
      // Warn on hardcoded hex colors (use Tailwind classes with design tokens)
      "no-restricted-syntax": [
        "warn",
        {
          "selector": "Literal[value=/#[0-9A-Fa-f]{6}/]",
          "message": "🎨 Use design tokens from tailwind.config instead of hardcoded hex colors"
        }
      ]
    },
  },
);
