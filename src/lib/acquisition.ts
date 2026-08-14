// Attribution d'acquisition (migration 034) : les UTM de l'URL d'arrivée sont
// capturés sur la landing, figés en localStorage, puis envoyés aux routes de
// création (session démo, carnet) qui les persistent en base. Partagé
// client/serveur : parseAcquisition est aussi la validation côté API.

export type Acquisition = {
  source: string
  campaign?: string
  content?: string
}

const STORAGE_KEY = 'mijote_acquisition'
const MAX_LEN = 60

// Allow-list des clés + troncature : la valeur vient d'une query string
// publique et repart dans des routes non authentifiées — on ne persiste
// jamais l'objet brut.
export function parseAcquisition(input: unknown): Acquisition | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Record<string, unknown>
  const clean = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_LEN) : undefined
  const source = clean(raw.source)
  if (!source) return null
  const acquisition: Acquisition = { source }
  const campaign = clean(raw.campaign)
  const content = clean(raw.content)
  if (campaign) acquisition.campaign = campaign
  if (content) acquisition.content = content
  return acquisition
}

// À l'arrivée sur la landing : si l'URL porte des UTM, on les fige — la
// conversion peut arriver des jours plus tard, depuis une autre page.
export function captureAcquisitionFromUrl(): Acquisition | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const captured = parseAcquisition({
    source: params.get('utm_source'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
  })
  if (captured) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(captured))
    } catch {
      // localStorage indisponible (navigation privée) : l'essai démo du clic
      // courant reste attribué via le retour de cette fonction.
    }
  }
  return captured ?? getStoredAcquisition()
}

export function getStoredAcquisition(): Acquisition | null {
  if (typeof window === 'undefined') return null
  try {
    return parseAcquisition(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return null
  }
}
