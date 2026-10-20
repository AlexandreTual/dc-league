'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/lib/client-error'

/**
 * Bas des pages d'erreur : envoie l'erreur au journal de l'administration et affiche son code
 * (digest de Next.js, présent quand l'erreur vient du serveur) pour qu'un joueur puisse le transmettre.
 */
export default function ErrorCode({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => reportClientError(error), [error])
  if (!error.digest) return null
  return (
    <p className="text-dc-muted text-xs" data-testid="error-digest">
      Code à transmettre : <code className="font-mono text-dc-text select-all">{error.digest}</code>
    </p>
  )
}
