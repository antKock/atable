import { describe, it, expect } from 'vitest'
import { aliasForOwner } from './alias'

// L'alias n'est jamais stocké : sa stabilité dans le temps est un contrat
// (le même owner doit garder le même alias à chaque rendu, chaque session).

describe('aliasForOwner', () => {
  it('est stable : même id → même alias, quelle que soit la casse', () => {
    const id = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
    expect(aliasForOwner(id)).toBe(aliasForOwner(id))
    expect(aliasForOwner(id.toUpperCase())).toBe(aliasForOwner(id))
  })

  it('a le format « Animal Adjectif » (deux mots capitalisés)', () => {
    const alias = aliasForOwner('550e8400-e29b-41d4-a716-446655440000')
    const words = alias.split(' ')
    expect(words).toHaveLength(2)
    for (const word of words) {
      expect(word[0]).toBe(word[0].toUpperCase())
    }
  })

  it('disperse grossièrement : beaucoup d’alias distincts sur 1000 ids', () => {
    // UUIDs synthétiques déterministes (pas de random en test) : la variation
    // porte sur tous les segments pour ne pas biaiser le hash.
    const aliases = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const hex = i.toString(16).padStart(4, '0')
      aliases.add(aliasForOwner(`${hex}8400-e29b-41d4-a716-4466554${hex}0`))
    }
    // 1600 combinaisons possibles ; on exige une dispersion large, pas parfaite.
    expect(aliases.size).toBeGreaterThan(300)
  })

  it('ne concentre pas tout sur un même animal ni un même adjectif', () => {
    const animals = new Set<string>()
    const adjectives = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const hex = i.toString(16).padStart(4, '0')
      const [animal, adjective] = aliasForOwner(`${hex}e8400-e29b-41d4-a716-446655440000`).split(' ')
      animals.add(animal)
      adjectives.add(adjective)
    }
    expect(animals.size).toBeGreaterThan(20)
    expect(adjectives.size).toBeGreaterThan(20)
  })
})
