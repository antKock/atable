'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { t } from '@/lib/i18n/fr'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  HOME_HIDDEN_FOYERS_COOKIE,
  HOME_HIDDEN_FOYERS_MAX_AGE,
} from '@/lib/home-foyers'

type Foyer = { id: string; name: string }

type Props = {
  // Tous les foyers de l'owner (≥ 2 — l'entrée n'est rendue qu'en multi-foyer).
  foyers: Foyer[]
  // Ids actuellement masqués de l'accueil (lus du cookie côté serveur).
  initialHiddenIds: string[]
}

// Réglage « foyers affichés sur l'accueil » (Design B) : une entrée dans le hub
// qui ouvre un dialog multi-sélection (cases Check par foyer). Réutilise
// ui/dialog + le motif de lignes de HouseholdPickerDialog. La sélection
// s'applique immédiatement (cookie device-scoped) ; l'accueil la relit à sa
// prochaine visite (SWR revalidateOnMount sur /api/carousels).
export default function HomeFoyersSetting({ foyers, initialHiddenIds }: Props) {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(initialHiddenIds.filter((id) => foyers.some((f) => f.id === id))),
  )

  const shownCount = foyers.length - hidden.size

  // Persistance : cookie device-scoped (comme les dismiss de hints). L'écriture
  // vit dans un effet (recommandation du compilateur React pour un effet de
  // bord sur `document`), déclenché à chaque changement de sélection — jamais au
  // montage (le cookie serveur fait déjà foi).
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    document.cookie = `${HOME_HIDDEN_FOYERS_COOKIE}=${[...hidden].join(',')}; max-age=${HOME_HIDDEN_FOYERS_MAX_AGE}; path=/`
  }, [hidden])

  function toggle(id: string) {
    const next = new Set(hidden)
    if (next.has(id)) {
      next.delete(id) // ré-affiche
    } else {
      // Interdit de masquer le DERNIER foyer affiché (accueil jamais vide).
      if (foyers.length - next.size <= 1) return
      next.add(id)
    }
    setHidden(next)
  }

  const summary =
    hidden.size === 0
      ? t.household.homeFoyers.summaryAll
      : t.household.homeFoyers.summaryCount(shownCount, foyers.length)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <SlidersHorizontal size={18} className="shrink-0 text-accent" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-foreground">
            {t.household.homeFoyers.entry}
          </span>
          <span className="block text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.household.homeFoyers.title}</DialogTitle>
            <DialogDescription>{t.household.homeFoyers.note}</DialogDescription>
          </DialogHeader>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {foyers.map((foyer) => {
              const shown = !hidden.has(foyer.id)
              // Le dernier foyer affiché n'est pas désélectionnable.
              const locked = shown && shownCount === 1
              return (
                <li key={foyer.id}>
                  <button
                    type="button"
                    aria-pressed={shown}
                    disabled={locked}
                    onClick={() => toggle(foyer.id)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-[15px] font-medium ${
                        shown ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {foyer.name}
                    </span>
                    <Check
                      size={18}
                      className={`shrink-0 text-accent transition-opacity ${
                        shown ? 'opacity-100' : 'opacity-0'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              )
            })}
          </ul>

          {shownCount === 1 && (
            <p className="text-xs text-muted-foreground">{t.household.homeFoyers.minWarning}</p>
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)} className="min-h-11 w-full">
              {t.household.homeFoyers.done}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
