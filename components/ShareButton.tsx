'use client'

import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import { canShare, shareOrCopy, type ShareData } from '@/lib/share'
import { useT } from '@/components/i18n/I18nProvider'

/**
 * Bouton « Partager » (partage natif du téléphone). Affiché seulement si `navigator.share`
 * existe, vérifié après le montage pour que le rendu serveur et le premier rendu client concordent.
 * Partage annulé ou refusé : rien ne se passe. `getData` est lu au clic (l'adresse de la page
 * n'existe pas au rendu serveur).
 */
export default function ShareButton({ getData, className, disabled }: { getData: () => ShareData; className: string; disabled?: boolean }) {
  const t = useT()
  const [available, setAvailable] = useState(false)
  useEffect(() => setAvailable(canShare(navigator)), [])
  if (!available) return null
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => void shareOrCopy(navigator, getData())}>
      <Share2 className="inline w-4 h-4 mr-1" />{t.common.share.button}
    </button>
  )
}
