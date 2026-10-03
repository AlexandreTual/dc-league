'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

export default function InvitationForm({ token, kind }: { token: string; kind: 'signup' | 'reset' }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) return setError('Les mots de passe ne correspondent pas')
    setError('')
    setLoading(true)
    const { error } = await sendJson(`/api/auth/invitation/${encodeURIComponent(token)}`, 'POST', {
      username: kind === 'signup' ? username : undefined,
      password,
      passwordConfirm,
    })
    if (error) {
      setLoading(false)
      return setError(error)
    }
    router.push('/profil')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      {kind === 'signup' && (
        <div>
          <label className={labelClass} htmlFor="username">Pseudo de connexion</label>
          <input id="username" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          <p className="text-dc-muted text-xs mt-1">3 à 32 caractères : lettres, chiffres, _ . -</p>
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="password">Mot de passe</label>
        <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <p className="text-dc-muted text-xs mt-1">8 caractères minimum</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="passwordConfirm">Confirmation</label>
        <input id="passwordConfirm" type="password" className={inputClass} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <button type="submit" disabled={loading || !password || (kind === 'signup' && !username)} className={primaryButtonClass}>
        {loading ? 'Enregistrement…' : kind === 'signup' ? 'Créer mon compte' : 'Changer mon mot de passe'}
      </button>
    </form>
  )
}
