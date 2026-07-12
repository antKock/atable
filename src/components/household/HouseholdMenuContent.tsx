import Link from 'next/link'
import { ChevronRight, Plus, ShieldCheck } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import type { MembershipRole } from '@/lib/auth/owner-context'
import RolePill from './RolePill'
import HomeFoyersSetting from './HomeFoyersSetting'

type HubHousehold = {
  id: string
  name: string
  role: MembershipRole
  isDemo: boolean
  people: number
  recipes: number
}

type Props = {
  ownerDisplayName: string
  households: HubHousehold[]
  isDemo: boolean
  // Sous-titre de la ligne « Toi » (#14) : accès sauvegardé ou à sauvegarder
  hasRecoveryEmail: boolean
  // Foyers actuellement masqués de l'accueil (cookie) — pour le réglage multi-foyer.
  hiddenFoyerIds: string[]
}

// Hub « Toi + Tes foyers » (maquette 0.2). Mono-foyer à ce lot, mais l'UI est
// construite pour N foyers et les rôles. En démo (stratégie C) : vue gelée —
// pas de ligne « Toi », pas de « Créer ou rejoindre » ; la bannière démo reste
// le chemin de conversion.
export default function HouseholdMenuContent({
  ownerDisplayName,
  households,
  isDemo,
  hasRecoveryEmail,
  hiddenFoyerIds,
}: Props) {
  // Réglage « affichés sur l'accueil » : pertinent seulement à partir de 2 foyers.
  const showHomeFoyersSetting = !isDemo && households.length >= 2
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <h1
        className="mb-6 text-foreground"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontVariationSettings: '"opsz" 144',
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        {t.household.menu}
      </h1>

      {!isDemo && (
        <section className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.household.sectionYou}
          </p>
          <div className="rounded-xl border border-border bg-surface">
            <Link
              href="/household/profile"
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <ShieldCheck size={18} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-foreground">
                  {ownerDisplayName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {hasRecoveryEmail ? t.household.accessSaved : t.household.accessToSave}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.household.sectionHouseholds}
        </p>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {households.map((household) => (
            <Link
              key={household.id}
              href={`/household/${household.id}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium text-foreground">
                    {household.name}
                  </span>
                  {household.isDemo && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {t.household.demoLabel}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RolePill role={household.role} />
                  {t.household.peopleCount(household.people)} · {t.household.recipeCount(household.recipes)}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
          {!isDemo && (
            <Link
              href="/household/switch"
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <Plus size={18} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="flex-1 text-[15px] font-semibold text-accent">
                {t.household.createOrJoin}
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* Réglage d'affichage — section À PART de la liste des foyers rejoints
          (ce sont deux choses distinctes : ce que tu as rejoint vs ce que tu
          affiches sur l'accueil). */}
      {showHomeFoyersSetting && (
        <section className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.household.homeFoyers.section}
          </p>
          <div className="rounded-xl border border-border bg-surface">
            <HomeFoyersSetting
              foyers={households.map((h) => ({ id: h.id, name: h.name }))}
              initialHiddenIds={hiddenFoyerIds}
            />
          </div>
        </section>
      )}
    </div>
  )
}
