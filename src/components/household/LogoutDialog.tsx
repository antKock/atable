'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n/fr'
import { haptics } from '@/lib/haptics'
import { dropSwrCache } from '@/lib/swr'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  // Adapte l'avertissement : sans email de secours, se déconnecter peut faire
  // perdre l'accès aux foyers (aucun moyen de revenir sans le code d'invitation).
  hasRecoveryEmail: boolean
}

// Bouton « Se déconnecter » du profil — même gabarit que les CTA « Quitter le
// foyer » (ghost destructif + confirmation, ui/dialog). La déconnexion passe par
// GET /api/auth/session/clear (purge du cookie + retour à la landing).
export default function LogoutDialog({ hasRecoveryEmail }: Props) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function logout() {
    setSubmitting(true)
    void haptics.heavy()
    // Le cache SWR appartient à la session courante : ne pas le laisser fuiter.
    dropSwrCache()
    window.location.href = '/api/auth/session/clear'
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10">
      <div className="flex flex-col gap-1 border-t border-border pt-5">
        <Button
          variant="ghost"
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {t.profile.logout}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t.profile.logoutConfirmTitle}</DialogTitle>
            <DialogDescription>
              {hasRecoveryEmail
                ? t.profile.logoutConfirmBody
                : t.profile.logoutConfirmBodyNoEmail}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="min-h-11"
            >
              {t.actions.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={logout}
              disabled={submitting}
              className="min-h-11"
            >
              {t.profile.logoutAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
