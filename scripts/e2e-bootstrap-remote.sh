#!/usr/bin/env bash
# Bootstrap de la stack E2E dans un environnement Claude Code web (conteneur
# éphémère, réseau derrière un proxy filtrant). Reproduit les prérequis de
# `npm run test:e2e:setup` malgré les restrictions de l'environnement :
#
#   1. le démon Docker n'est pas lancé au démarrage        → on le démarre
#   2. les releases GitHub sont bloquées par le proxy      → binaire supabase
#      officiel récupéré via npm (@supabase/cli-linux-x64), registre autorisé
#   3. supabase_edge_runtime ne démarre pas (rlimit interdit en conteneur
#      imbriqué)                                           → exclu (`-x edge-runtime`),
#      le projet n'utilise pas les Edge Functions
#   4. la CLI ≥ 2.99 ne pose plus les grants service_role en local (dérive vs
#      la 2.78 épinglée)                                   → GRANT explicite
#   5. le Chromium préinstallé (/opt/pw-browsers) n'est pas le build attendu
#      par la version @playwright/test du lockfile         → pont par symlinks
#
# Usage : bash scripts/e2e-bootstrap-remote.sh    puis    npm run test:e2e
# Idempotent : chaque étape se saute si déjà faite.
set -euo pipefail
cd "$(dirname "$0")/.."

# Version des binaires CLI publiés sur npm (les binaires commencent à la 2.99 ;
# compatible avec le wrapper ^2.78 du package.json). Testé : 2.109.1.
SUPABASE_BIN_VERSION="${SUPABASE_BIN_VERSION:-2.109.1}"

step() { printf '\n— %s\n' "$1"; }

# 1. Démon Docker
if ! docker info >/dev/null 2>&1; then
  step "Démarrage du démon Docker"
  (dockerd >/tmp/dockerd.log 2>&1 &)
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
  docker info >/dev/null 2>&1 || { echo "✗ dockerd ne démarre pas (voir /tmp/dockerd.log)"; exit 1; }
fi

# 2. node_modules (postinstall de `supabase` bloqué par le proxy → --ignore-scripts)
if [ ! -d node_modules/.bin ]; then
  step "npm ci --ignore-scripts"
  npm ci --no-audit --no-fund --ignore-scripts
fi

# 3. Binaire supabase depuis npm (le postinstall GitHub étant bloqué)
if [ ! -x node_modules/supabase/bin/supabase-go ]; then
  step "Binaire supabase ${SUPABASE_BIN_VERSION} via registry.npmjs.org"
  tmp="$(mktemp -d)"
  curl -fsSL "https://registry.npmjs.org/@supabase/cli-linux-x64/-/cli-linux-x64-${SUPABASE_BIN_VERSION}.tgz" -o "$tmp/cli.tgz"
  tar -xzf "$tmp/cli.tgz" -C "$tmp"
  mkdir -p node_modules/supabase/bin
  cp "$tmp/package/bin/supabase" "$tmp/package/bin/supabase-go" node_modules/supabase/bin/
  chmod +x node_modules/supabase/bin/supabase node_modules/supabase/bin/supabase-go
  ln -sf ../supabase/bin/supabase node_modules/.bin/supabase
  rm -rf "$tmp"
fi
export SUPABASE_GO_BINARY="$PWD/node_modules/supabase/bin/supabase-go"

# 4. Pont Chromium : symlinke le build préinstallé vers celui attendu par le
# @playwright/test du lockfile (layouts différents selon les révisions).
PW_DIR="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
if [ -d "$PW_DIR" ]; then
  step "Pont Chromium ($PW_DIR)"
  node - "$PW_DIR" <<'EOF'
const fs = require('fs'), path = require('path')
const pwDir = process.argv[2]
const browsers = JSON.parse(fs.readFileSync(path.join('node_modules', 'playwright-core', 'browsers.json'), 'utf8')).browsers
const have = (prefix) => fs.readdirSync(pwDir).find((d) => d.startsWith(prefix + '-'))
for (const [name, binRel] of [
  ['chromium_headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell'],
  ['chromium', 'chrome-linux/chrome'],
]) {
  const rev = browsers.find((b) => b.name === name.replace('_headless_shell', '-headless-shell'))?.revision
    ?? browsers.find((b) => b.name === 'chromium')?.revision
  const want = path.join(pwDir, `${name}-${rev}`)
  const got = have(name)
  if (!got || fs.existsSync(path.join(want, 'INSTALLATION_COMPLETE'))) continue
  const src = path.join(pwDir, got, 'chrome-linux')
  const dstDir = path.join(want, path.dirname(binRel))
  fs.mkdirSync(dstDir, { recursive: true })
  for (const f of fs.readdirSync(src)) fs.symlinkSync(path.join(src, f), path.join(dstDir, f), 'file')
  const bin = path.join(want, binRel)
  if (!fs.existsSync(bin))
    fs.symlinkSync(path.join(src, fs.existsSync(path.join(src, 'headless_shell')) ? 'headless_shell' : 'chrome'), bin)
  for (const marker of ['INSTALLATION_COMPLETE', 'DEPENDENCIES_VALIDATED']) fs.writeFileSync(path.join(want, marker), '')
  console.log(`  ${got} → ${path.basename(want)}`)
}
EOF
fi

# 5. Supabase local, sans edge-runtime (rlimit interdit en conteneur imbriqué)
if ! curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:54321/rest/v1/ 2>/dev/null; then
  step "supabase start -x edge-runtime"
  npx supabase start -x edge-runtime
fi

# 6. Grants service_role (dérive CLI ≥ 2.99 : plus posés par défaut en local)
step "Grants service_role"
docker exec supabase_db_atable psql -U postgres -d postgres -q -c \
  "GRANT USAGE ON SCHEMA public TO service_role;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;"

# 7. Setup standard (clés locales, Redis + proxy REST, seed) — idempotent
step "npm run test:e2e:setup"
[ -f .env.test.local ] || cp .env.test.example .env.test.local
npm run test:e2e:setup

printf '\n✓ Stack E2E prête (environnement distant). Lance : npm run test:e2e\n'
