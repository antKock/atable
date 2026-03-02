const WORDS = [
  'OLIVE', 'THYME', 'CUMIN', 'ANISE', 'BASIL', 'FENNEL', 'CAPER', 'SORREL',
  'SAGE', 'MISO', 'DASHI', 'SUMAC', 'TAHINI', 'SAFFRON', 'PAPRIKA', 'CARAWAY',
  'CHIVE', 'CLOVE', 'CURRY', 'FARRO', 'GHEE', 'JUNIPER', 'KOMBU', 'LEMON',
  'MAPLE', 'NETTLE', 'ORZO', 'PANKO', 'QUINCE', 'RAMEN', 'SOBA', 'TAMARI',
  'UMAMI', 'VADOUVAN', 'WALNUT', 'YUZU', 'MIRIN', 'HARISSA', 'ZAATAR', 'DUKKAH',
  'FURIKAKE', 'GARAM', 'HERBES', 'IKURA', 'JICAMA', 'KATSU', 'LAVENDER',
  'MACE', 'NIGELLA', 'PONZU',
]

export function generateJoinCode(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)]
  const number = Math.floor(Math.random() * 10000)
  const padded = String(number).padStart(4, '0')
  return `${word}-${padded}`
}
