// Seed E2E (Supabase LOCAL uniquement) : bucket Storage, foyer démo et
// recettes seed. Idempotent — relançable à volonté (upsert par id fixe).
// Usage : node scripts/seed-e2e.mjs
import { createClient } from '@supabase/supabase-js'
import { loadTestEnv } from './e2e-env.mjs'

const env = loadTestEnv()

const url = env.NEXT_PUBLIC_SUPABASE_URL
if (!url || !/127\.0\.0\.1|localhost/.test(url)) {
  console.error(`Refus : NEXT_PUBLIC_SUPABASE_URL (${url}) ne pointe pas sur un Supabase local.`)
  process.exit(1)
}

const supabase = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY)

// 1. Bucket Storage — créé en dashboard dans les vrais environnements, donc
// absent des migrations : le local doit le créer lui-même.
const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
if (bucketsError) throw bucketsError
if (!buckets.some((b) => b.name === 'recipe-photos')) {
  const { error } = await supabase.storage.createBucket('recipe-photos', { public: true })
  if (error) throw error
  console.log('Bucket recipe-photos créé')
}

// 2. Foyer démo (id aligné sur DEMO_HOUSEHOLD_ID de .env.test.local)
const DEMO_ID = env.DEMO_HOUSEHOLD_ID
const { error: householdError } = await supabase
  .from('households')
  .upsert(
    { id: DEMO_ID, name: 'Démo Mijote', join_code: 'DEMO-0000', is_demo: true },
    { onConflict: 'id' },
  )
if (householdError) throw householdError

// 3. Recettes seed du foyer démo. Pas d'images (le Storage local est vide) :
// enrichment 'enriched' + image_status 'none' = fiche complète avec placeholder.
const seedRecipes = [
  {
    id: '00000000-0000-0000-0000-0000000ee001',
    title: 'Soupe de lentilles corail',
    ingredients: '250 g de lentilles corail\n1 oignon\n2 carottes\n1 litre de bouillon',
    steps: 'Faire revenir l’oignon.\nAjouter carottes et lentilles.\nMijoter 25 minutes puis mixer.',
    prep_time: '10-20 min',
    cook_time: '30 min - 1h',
    cost: '€',
    complexity: 'facile',
    seasons: ['printemps', 'ete', 'automne', 'hiver'],
  },
  {
    id: '00000000-0000-0000-0000-0000000ee002',
    title: 'Mousse au chocolat',
    ingredients: '200 g de chocolat noir\n6 œufs\n1 pincée de sel',
    steps: 'Fondre le chocolat.\nMonter les blancs.\nMélanger et réfrigérer 2 h.',
    prep_time: '20-30 min',
    cook_time: 'Aucune',
    cost: '€€',
    complexity: 'moyen',
    seasons: ['ete'],
  },
  {
    id: '00000000-0000-0000-0000-0000000ee003',
    title: 'Poulet rôti aux herbes',
    ingredients: '1 poulet entier\n4 gousses d’ail\n1 citron\nThym, romarin',
    steps: 'Préchauffer à 200°C.\nFrotter le poulet aux herbes.\nRôtir 1 h 15.',
    prep_time: '10-20 min',
    cook_time: '1h - 2h',
    cost: '€€',
    complexity: 'facile',
    seasons: ['automne', 'hiver'],
  },
]

const { error: recipesError } = await supabase.from('recipes').upsert(
  seedRecipes.map((r) => ({
    ...r,
    household_id: DEMO_ID,
    is_seed: true,
    source: 'manual',
    enrichment_status: 'enriched',
    image_status: 'none',
  })),
  { onConflict: 'id' },
)
if (recipesError) throw recipesError

console.log(`Seed E2E appliqué : foyer démo ${DEMO_ID} + ${seedRecipes.length} recettes seed`)
