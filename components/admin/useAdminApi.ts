'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { sendJson } from '@/components/formStyles'
import { createToaster } from '@/components/toast'

/** Résultat d'un appel : `ok` false quand l'erreur a déjà été affichée en message. */
export type ApiResult<T> = { ok: boolean; data?: T }

export type AdminApi = {
  /** Message temporaire affiché en haut de la page admin ('' = aucun). */
  toast: string
  showToast: (msg: string) => void
  /** Appel API dont l'erreur s'affiche en message « Erreur : … ». */
  call: <T>(url: string, method: string, body?: unknown) => Promise<ApiResult<T>>
}

/**
 * Appels API de l'admin et messages temporaires.
 * Un seul minuteur pour tous les toasts : un nouveau message annule l'effacement du précédent.
 * Les erreurs qui s'affichent dans une section (et non en message) passent par `sendJson` directement.
 */
export function useAdminApi(): AdminApi {
  const [toast, setToast] = useState('')

  const toasterRef = useRef<ReturnType<typeof createToaster> | null>(null)
  if (!toasterRef.current) toasterRef.current = createToaster(setToast)
  useEffect(() => () => toasterRef.current?.dispose(), [])
  const showToast = useCallback((msg: string) => toasterRef.current?.show(msg), [])

  const call = useCallback(
    async <T,>(url: string, method: string, body?: unknown): Promise<ApiResult<T>> => {
      const { error, data } = await sendJson(url, method, body)
      if (error) {
        showToast(`Erreur : ${error}`)
        return { ok: false }
      }
      return { ok: true, data: data as T }
    },
    [showToast]
  )

  return { toast, showToast, call }
}
