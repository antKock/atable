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
          // request.nextUrl.origin / .href (lecture directe).
          selector: "MemberExpression[object.property.name='nextUrl'][property.name=/^(origin|href)$/]",
          message:
            "nextUrl.origin / nextUrl.href sont faux derrière le reverse proxy : utiliser getRequestOrigin(request) (@/lib/request-origin).",
        },
        {
          // const { origin } = request.nextUrl (déstructuration).
          selector:
            "VariableDeclarator[init.type='MemberExpression'][init.property.name='nextUrl'] > ObjectPattern > Property[key.name=/^(origin|href)$/]",
          message:
            "Déstructurer origin/href depuis nextUrl est faux derrière le reverse proxy : utiliser getRequestOrigin(request) (@/lib/request-origin).",
        },
        {
          // request.nextUrl.clone() : l'URL clonée porte l'origine d'écoute.
          selector: "CallExpression[callee.object.property.name='nextUrl'][callee.property.name='clone']",
          message:
            "nextUrl.clone() porte l'origine d'écoute (0.0.0.0:3000) : construire l'URL avec new URL(chemin, getRequestOrigin(request)).",
        },
        {
          // new URL(chemin, request.url) / new URL(chemin, request.nextUrl) — limité aux
          // objets `req`, `_req`, `request` pour ne pas refuser new URL("img.png", recipe.url).
          selector:
            "NewExpression[callee.name='URL'][arguments.length=2][arguments.1.type='MemberExpression'][arguments.1.object.name=/^(_?req|request)$/][arguments.1.property.name=/^(url|nextUrl)$/]",
          message:
            "new URL(chemin, request.url) construit une URL absolue sur l'adresse d'écoute : utiliser new URL(chemin, getRequestOrigin(request)).",
        },
      ],
      // Langue : `t` de fr.ts fige le français quel que soit l'appareil. Les chaînes
      // passent par useT() (client) / getT() (serveur) — règle CLAUDE.md (Version EN).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/i18n/fr", "**/i18n/fr", "./fr"],
              message:
                "importer `t` de fr.ts fige la langue : useT() côté client, getT() côté serveur (règle CLAUDE.md)",
            },
          ],
        },
      ],
    },
  },
  {
    // Seule implémentation autorisée du repli sur nextUrl.
    files: ["src/lib/request-origin.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Import direct de fr.ts toléré : tests, admin, défauts de schémas, catalogue des
    // carrousels (libellés FR de référence) et le module i18n lui-même.
    files: [
      "src/**/*.test.{ts,tsx}",
      "src/test/**",
      "src/app/admin/**",
      "src/lib/admin/**",
      "src/lib/schemas/**",
      "src/lib/carousels/catalog.ts",
      "src/lib/i18n/**",
    ],
    rules: { "no-restricted-imports": "off" },
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
