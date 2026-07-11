export type Household = {
  id: string
  name: string
  joinCode: string
  isDemo: boolean
  createdAt: string
}

// Décommissionnement du chantier foyer (Lot 4) : le `sid` est l'UNIQUE clé de
// résolution — chaque requête serveur résout `device_session → owner →
// memberships` en DB. Le `hid` (foyer d'onboarding) a disparu du JWT : plus
// aucune route ni page ne scope sur lui. Les anciens cookies portent encore un
// claim `hid` (ignoré par verifySession) — aucune migration de cookie n'est
// nécessaire.
export type SessionPayload = {
  sid: string
  iat: number
}
