'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/components/i18n/I18nProvider'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

export default function InvitationForm({ token, kind, target }: { token: string; kind: 'signup' | 'reset'; target: string }) {
  const router = useRouter()
  const m = useT().account.invitation
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) return setError(m.mismatch)
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
    router.push(target)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      {kind === 'signup' && (
        <div>
          <label className={labelClass} htmlFor="username">{m.username}</label>
          <input id="username" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          <p className="text-dc-muted text-xs mt-1">{m.usernameHint}</p>
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="password">{m.password}</label>
        <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <p className="text-dc-muted text-xs mt-1">{m.passwordHint}</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="passwordConfirm">{m.confirm}</label>
        <input id="passwordConfirm" type="password" className={inputClass} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <button type="submit" disabled={loading || !password || (kind === 'signup' && !username)} className={primaryButtonClass}>
        {loading ? m.saving : kind === 'signup' ? m.createAccount : m.changePassword}
      </button>
    </form>
  )
}
