import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-plugin-jsx-a11y is bundled by eslint-config-next — escalate to errors so builds fail on violations
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
    },
  },
  {
    // Code applicatif uniquement (les scripts ne tournent pas derrière le proxy).
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Origine des URL absolues : derrière un reverse proxy (VPS, Traefik),
      // `request.url` / `nextUrl.origin` valent l'adresse d'écoute du serveur
      // (http://0.0.0.0:3000). Toute URL absolue ou redirection passe par
      // getRequestOrigin() (src/lib/request-origin.ts) — cf. docs/infra/migration-vps-ovh.md.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.property.name='nextUrl'][property.name='origin']",
          message:
            "nextUrl.origin est faux derrière le reverse proxy : utiliser getRequestOrigin(request) (@/lib/request-origin).",
        },
        {
          selector:
            "NewExpression[callee.name='URL'][arguments.length=2][arguments.1.type='MemberExpression'][arguments.1.property.name='url']",
          message:
            "new URL(chemin, request.url) construit une URL absolue sur l'adresse d'écoute : utiliser new URL(chemin, getRequestOrigin(request)).",
        },
      ],
    },
  },
  {
    // Seule implémentation autorisée du repli sur nextUrl.
    files: ["src/lib/request-origin.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright artifacts:
    "test-results/**",
    "playwright-report/**",
    // Design references (handoff mockups), not production code:
    "docs/specs/**/handoff/**",
    // Gitignored local-only paths (scratch space, Android build artifacts):
    "temp/**",
    "android/**/build/**",
  ]),
]);

export default eslintConfig;
