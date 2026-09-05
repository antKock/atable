import type { Locale } from '@/lib/i18n/locale'

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

// Version EN (chantier i18n) : format « Adjective Animal » (« Curious Fox »),
// même principe — déterministe par owner id, jamais stocké. L'alias dépend de
// la langue du LECTEUR (décision : la langue suit l'appareil) : un même owner
// est « Renard Curieux » pour un membre FR et « Curious Fox » pour un membre EN.
const ANIMALS_EN = [
  'Rabbit', 'Fox', 'Heron', 'Sparrow', 'Beaver', 'Owl',
  'Squirrel', 'Hedgehog', 'Falcon', 'Wolf', 'Bear', 'Stag', 'Deer',
  'Nightingale', 'Finch', 'Duck', 'Swan', 'Dolphin',
  'Chamois', 'Lynx', 'Cat', 'Pony',
  'Ram', 'Bull', 'Boar', 'Lizard', 'Butterfly',
  'Cricket', 'Hummingbird', 'Flamingo', 'Pelican', 'Seagull', 'Blackbird',
] as const

const ADJECTIVES_EN = [
  'Quiet', 'Curious', 'Peaceful', 'Attentive', 'Careful', 'Dreamy',
  'Serene', 'Brave', 'Modest', 'Patient', 'Kind', 'Loyal', 'Agile',
  'Skillful', 'Calm', 'Thoughtful', 'Composed', 'Courteous', 'Sincere',
  'Faithful', 'Tenacious', 'Lively', 'Wise', 'Gentle', 'Alert',
  'Placid', 'Studious', 'Tidy',
  'Shrewd', 'Lucid', 'Fearless', 'Hungry', 'Early', 'Nocturnal',
  'Wandering',
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
export function aliasForOwner(ownerId: string, locale: Locale = 'fr'): string {
  const hash = fnv1a(ownerId.toLowerCase())
  if (locale === 'en') {
    const animal = ANIMALS_EN[hash % ANIMALS_EN.length]
    const adjective = ADJECTIVES_EN[Math.floor(hash / ANIMALS_EN.length) % ADJECTIVES_EN.length]
    return `${adjective} ${animal}`
  }
  const animal = ANIMALS[hash % ANIMALS.length]
  const adjective = ADJECTIVES[Math.floor(hash / ANIMALS.length) % ADJECTIVES.length]
  return `${animal} ${adjective}`
}
