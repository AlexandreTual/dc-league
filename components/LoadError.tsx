import { AlertTriangle } from 'lucide-react'

/** Message affiché par une page serveur quand une requête à la base échoue. */
export default function LoadError({ what }: { what: string }) {
  return (
    <div role="alert" className="text-center py-16 space-y-3">
      <AlertTriangle className="w-10 h-10 mx-auto text-dc-red-light opacity-70" />
      <p className="text-dc-text">Impossible de charger {what}.</p>
      <p className="text-dc-muted text-sm">Réessaie dans un instant en rechargeant la page.</p>
    </div>
  )
}
