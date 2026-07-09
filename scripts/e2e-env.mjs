// Chargeur de .env.test.local partagé par les scripts E2E (seed, setup).
// Volontairement sans dépendance : parse KEY=VALUE, ignore commentaires/vides.
import fs from 'node:fs'
import path from 'node:path'

export const ENV_TEST_FILE = '.env.test.local'

export function loadTestEnv(rootDir = process.cwd()) {
  const filePath = path.join(rootDir, ENV_TEST_FILE)
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${ENV_TEST_FILE} introuvable. Crée-le d'abord : cp .env.test.example ${ENV_TEST_FILE}`,
    )
  }
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}
