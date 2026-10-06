'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

export default function LoginForm({ target, showBootstrap }: { target: string; showBootstrap: boolean }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent, body: object, destination: string) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await sendJson('/api/auth/login', 'POST', body)
    setLoading(false)
    if (error) return setError(error)
    router.push(destination)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => submit(e, { username, password }, target)} className={cardClass}>
        <div>
          <label className={labelClass} htmlFor="username">Pseudo</label>
          <input id="username" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">Mot de passe</label>
          <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className={errorClass}>{error}</p>}
        <button type="submit" disabled={!username || !password || loading} className={primaryButtonClass}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="text-xs text-center">
          <Link href="/mot-de-passe-oublie" className="text-dc-muted hover:text-dc-gold underline">Mot de passe oublié ?</Link>
        </p>
      </form>

      {showBootstrap && (
        <details className="bg-dc-surface border border-dc-border rounded-2xl p-4 text-sm">
          <summary className="cursor-pointer text-dc-muted">Première configuration : mot de passe admin</summary>
          <form onSubmit={(e) => submit(e, { adminPassword }, '/admin')} className="space-y-3 mt-4">
            <p className="text-dc-muted text-xs">
              Disponible uniquement tant qu&apos;aucun compte admin n&apos;existe. Une fois connecté, génère ton invitation « admin » depuis l&apos;administration.
            </p>
            <input type="password" className={inputClass} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Mot de passe admin" />
            <button type="submit" disabled={!adminPassword || loading} className={primaryButtonClass}>Entrer</button>
          </form>
        </details>
      )}
    </div>
  )
}
