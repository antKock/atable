// Alias auto d'un owner sans nom (chantier foyer, Lot 1) : dérivé
// DÉTERMINISTE de l'owner id — jamais stocké en DB (owners.name reste NULL).
// Format « Animal Adjectif » (cf. maquette 0.3 : « Lapin Farceur »), ton
// sobre. Tous les animaux sont masculins pour que l'accord des adjectifs
// tienne sans déclinaison.

// Animaux masculins, ton sobre. Écartés (surnoms désagréables) : Blaireau,
// Phoque, Corbeau, Mouton, Bourdon, Manchot, Bouquetin.
const ANIMALS = [
  'Lapin', 'Renard', 'Héron', 'Moineau', 'Castor', 'Hibou',
  'Écureuil', 'Hérisson', 'Faucon', 'Loup', 'Ours', 'Cerf', 'Chevreuil',
  'Rossignol', 'Pinson', 'Canard', 'Cygne', 'Dauphin',
  'Chamois', 'Lynx', 'Chat', 'Poney',
  'Bélier', 'Taureau', 'Marcassin', 'Lézard', 'Papillon',
  'Grillon', 'Colibri', 'Flamant', 'Pélican', 'Goéland', 'Merle',
] as const

// Écartés (connotation péjorative ou fade) : Candide, Léger, Débonnaire, Affable.
const ADJECTIVES = [
  'Discret', 'Curieux', 'Paisible', 'Attentif', 'Prudent', 'Songeur',
  'Serein', 'Vaillant', 'Modeste', 'Patient', 'Aimable', 'Loyal', 'Agile',
  'Habile', 'Tranquille', 'Réfléchi', 'Posé', 'Courtois', 'Sincère',
  'Fidèle', 'Tenace', 'Vif', 'Sage', 'Calme', 'Doux', 'Alerte',
  'Placide', 'Studieux', 'Soigneux',
  'Avisé', 'Lucide', 'Intrépide', 'Gourmand', 'Matinal', 'Nocturne',
  'Voyageur',
] as const

// FNV-1a 32 bits : simple, stable, sans dépendance. L'UUID est hashé tel
// quel (casse normalisée) ; la qualité de dispersion suffit largement pour
// répartir ~1600 combinaisons.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Alias affiché pour un owner sans nom. Déterministe : même id → même alias. */
export function aliasForOwner(ownerId: string): string {
  const hash = fnv1a(ownerId.toLowerCase())
  const animal = ANIMALS[hash % ANIMALS.length]
  const adjective = ADJECTIVES[Math.floor(hash / ANIMALS.length) % ADJECTIVES.length]
  return `${animal} ${adjective}`
}
