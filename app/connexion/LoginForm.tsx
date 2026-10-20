'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/components/i18n/I18nProvider'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

export default function LoginForm({ target, showBootstrap }: { target: string; showBootstrap: boolean }) {
  const router = useRouter()
  const t = useT()
  const m = t.account.login
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
          <label className={labelClass} htmlFor="username">{m.username}</label>
          <input id="username" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">{m.password}</label>
          <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className={errorClass}>{error}</p>}
        <button type="submit" disabled={!username || !password || loading} className={primaryButtonClass}>
          {loading ? m.submitting : m.submit}
        </button>
        <p className="text-xs text-center">
          <Link href="/mot-de-passe-oublie" className="text-dc-muted hover:text-dc-gold underline">{m.forgot}</Link>
        </p>
      </form>

      {showBootstrap && (
        <details className="bg-dc-surface border border-dc-border rounded-2xl p-4 text-sm">
          <summary className="cursor-pointer text-dc-muted">{m.bootstrapTitle}</summary>
          <form onSubmit={(e) => submit(e, { adminPassword }, '/admin')} className="space-y-3 mt-4">
            <p className="text-dc-muted text-xs">
              {m.bootstrapHelp}
            </p>
            <input type="password" className={inputClass} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder={m.adminPassword} />
            <button type="submit" disabled={!adminPassword || loading} className={primaryButtonClass}>{m.enter}</button>
          </form>
        </details>
      )}
    </div>
  )
}
