'use client'

import { AlertTriangle } from 'lucide-react'
import { useT } from '@/components/i18n/I18nProvider'

/** Message affiché par une page serveur quand une requête à la base échoue ; `what` est déjà dans la langue de la page. */
export default function LoadError({ what }: { what: string }) {
  const t = useT()
  return (
    <div role="alert" className="text-center py-16 space-y-3">
      <AlertTriangle className="w-10 h-10 mx-auto text-dc-red-light opacity-70" />
      <p className="text-dc-text">{t.site.loadError.title(what)}</p>
      <p className="text-dc-muted text-sm">{t.site.loadError.retry}</p>
    </div>
  )
}
