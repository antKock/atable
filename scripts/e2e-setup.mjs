// Prépare (idempotent) la stack E2E locale : Supabase local, Redis local
// derrière un proxy REST compatible Upstash, et seed.
// Usage : node scripts/e2e-setup.mjs [--reset]
//   --reset : supabase db reset (ré-applique les migrations, base vidée) avant le seed.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ENV_TEST_FILE, loadTestEnv } from './e2e-env.mjs'

const RESET = process.argv.includes('--reset')
const REDIS_NETWORK = 'mijote-e2e'
const REDIS_CONTAINER = 'mijote-e2e-redis'
const SRH_CONTAINER = 'mijote-e2e-srh'

let env = loadTestEnv()

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

function fail(message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

// 1. Docker
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  fail('Docker inaccessible. Démarre le runtime (colima start) puis relance.')
}

// 2. Supabase local (no-op si déjà démarré)
async function supabaseIsUp() {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(3000),
    })
    return res.status < 500
  } catch {
    return false
  }
}

if (!(await supabaseIsUp())) {
  console.log('Démarrage de Supabase local…')
  run('npx', ['supabase', 'start'])
}
if (RESET) {
  console.log('Reset de la base locale (migrations ré-appliquées)…')
  run('npx', ['supabase', 'db', 'reset', '--local'])
}

// Clés Supabase locales : absentes de .env.test.example (la protection
// anti-secrets GitHub bloque leur motif) → remplies ici depuis supabase status.
if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  const status = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
  const read = (key) => status.match(new RegExp(`^${key}="([^"]+)"`, 'm'))?.[1]
  const anon = read('PUBLISHABLE_KEY') || read('ANON_KEY')
  const secret = read('SECRET_KEY') || read('SERVICE_ROLE_KEY')
  if (!anon || !secret) fail('Impossible de lire les clés locales via `supabase status`.')
  const filePath = path.join(process.cwd(), ENV_TEST_FILE)
  const content = fs
    .readFileSync(filePath, 'utf8')
    .replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/m, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`)
    .replace(/^SUPABASE_SERVICE_ROLE_KEY=.*$/m, `SUPABASE_SERVICE_ROLE_KEY=${secret}`)
  fs.writeFileSync(filePath, content)
  console.log(`Clés Supabase locales écrites dans ${ENV_TEST_FILE}`)
  env = loadTestEnv()
}

// 3. Redis + SRH (proxy REST compatible Upstash). Nécessaire : les routes
// join/lookup ne sont pas fail-open — sans Redis joignable elles renvoient 500.
function containerRunning(name) {
  const out = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', name], {
    encoding: 'utf8',
  })
  return out.status === 0 && out.stdout.trim() === 'true'
}

spawnSync('docker', ['network', 'create', REDIS_NETWORK], { stdio: 'ignore' })
if (!containerRunning(REDIS_CONTAINER)) {
  spawnSync('docker', ['rm', '-f', REDIS_CONTAINER], { stdio: 'ignore' })
  run('docker', [
    'run', '-d', '--name', REDIS_CONTAINER, '--network', REDIS_NETWORK,
    '--restart', 'unless-stopped', 'redis:7-alpine',
  ])
}
if (!containerRunning(SRH_CONTAINER)) {
  spawnSync('docker', ['rm', '-f', SRH_CONTAINER], { stdio: 'ignore' })
  const srhPort = new URL(env.UPSTASH_REDIS_REST_URL).port || '80'
  run('docker', [
    'run', '-d', '--name', SRH_CONTAINER, '--network', REDIS_NETWORK,
    '--restart', 'unless-stopped', '-p', `${srhPort}:80`,
    '-e', 'SRH_MODE=env',
    '-e', `SRH_TOKEN=${env.UPSTASH_REDIS_REST_TOKEN}`,
    '-e', `SRH_CONNECTION_STRING=redis://${REDIS_CONTAINER}:6379`,
    'hiett/serverless-redis-http:latest',
  ])
}

// Attendre que le proxy réponde (format @upstash/redis : POST JSON)
async function redisPing() {
  try {
    const res = await fetch(env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['PING']),
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}

let up = false
for (let i = 0; i < 15 && !up; i++) {
  up = await redisPing()
  if (!up) await new Promise((r) => setTimeout(r, 1000))
}
if (!up) fail(`Le proxy Redis (${env.UPSTASH_REDIS_REST_URL}) ne répond pas.`)

// 4. Seed (idempotent)
run('node', ['scripts/seed-e2e.mjs'])

console.log('\n✓ Stack E2E prête. Lance : npm run test:e2e')
