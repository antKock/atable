import Bowser from 'bowser'

const UNKNOWN_DEVICE = 'Appareil inconnu'
const UNKNOWN_BROWSER = 'Navigateur inconnu'
const SEPARATOR = ' \u00B7 ' // U+00B7 middle dot

export function getDeviceName(userAgent: string): string {
  if (!userAgent) {
    return `${UNKNOWN_DEVICE}${SEPARATOR}${UNKNOWN_BROWSER}`
  }

  let devicePart: string | null = null
  let browserPart: string | null = null

  try {
    const parsed = Bowser.parse(userAgent)

    const model = parsed.platform?.model       // e.g. "iPhone", "iPad"
    const vendor = parsed.platform?.vendor     // e.g. "Apple", "Samsung"
    const os = parsed.os?.name                 // e.g. "iOS", "Android", "macOS"
    const browser = parsed.browser?.name       // e.g. "Safari", "Chrome"

    if (model) {
      devicePart = vendor ? `${vendor} ${model}` : model
    } else if (os) {
      devicePart = os
    }

    if (browser) {
      browserPart = browser
    }
  } catch {
    // Fall through to fallbacks
  }

  return `${devicePart ?? UNKNOWN_DEVICE}${SEPARATOR}${browserPart ?? UNKNOWN_BROWSER}`
}
