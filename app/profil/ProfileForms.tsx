'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useT } from '@/components/i18n/I18nProvider'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson, successClass } from '@/components/formStyles'

type Status = { error: string; success: string }
const idle: Status = { error: '', success: '' }

export default function ProfileForms({ initialName, initialAvatarUrl, initialEmail }: {
  initialName: string
  initialAvatarUrl: string
  initialEmail: string
}) {
  const router = useRouter()
  const m = useT().account.profile
  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [profileStatus, setProfileStatus] = useState<Status>(idle)

  const [email, setEmail] = useState(initialEmail)
  const [savedEmail, setSavedEmail] = useState(initialEmail)
  const [emailStatus, setEmailStatus] = useState<Status>(idle)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<Status>(idle)
  const [loading, setLoading] = useState(false)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await sendJson('/api/me/profile', 'PATCH', { name, avatar_url: avatarUrl })
    setLoading(false)
    setProfileStatus(error ? { error, success: '' } : { error: '', success: m.saved })
    if (!error) router.refresh()
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error, data } = await sendJson('/api/me/email', 'PATCH', { email: email.trim() || null })
    setLoading(false)
    if (error) return setEmailStatus({ error, success: '' })
    const saved = (data as { email: string | null }).email ?? ''
    setEmail(saved)
    setSavedEmail(saved)
    setEmailStatus({ error: '', success: saved ? m.emailSaved : m.emailCleared })
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) return setPasswordStatus({ error: m.mismatch, success: '' })
    setLoading(true)
    const { error } = await sendJson('/api/me/password', 'PATCH', { currentPassword, newPassword })
    setLoading(false)
    if (error) return setPasswordStatus({ error, success: '' })
    setCurrentPassword('')
    setNewPassword('')
    setConfirm('')
    setPasswordStatus({ error: '', success: m.passwordChanged })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className={cardClass}>
        <h2 className="font-fantasy text-lg text-dc-text">{m.section}</h2>
        <div>
          <label className={labelClass} htmlFor="name">{m.name}</label>
          <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="avatar">{m.avatar}</label>
          <div className="flex items-center gap-3">
            {avatarUrl.startsWith('https://') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-dc-gold/40 shrink-0" />
            )}
            <input id="avatar" className={inputClass} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        {profileStatus.error && <p className={errorClass}>{profileStatus.error}</p>}
        {profileStatus.success && <p className={successClass}>{profileStatus.success}</p>}
        <button type="submit" disabled={loading || !name.trim()} className={primaryButtonClass}>{m.save}</button>
      </form>

      <form onSubmit={saveEmail} className={cardClass} noValidate>
        <h2 className="font-fantasy text-lg text-dc-text">{m.emailTitle}</h2>
        {!savedEmail && (
          <p data-testid="email-banner" className="text-sm text-dc-gold bg-dc-gold/10 border border-dc-gold/30 rounded-lg px-3 py-2">
            {m.emailBanner}
          </p>
        )}
        <div>
          <label className={labelClass} htmlFor="email">{m.email}</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder={m.emailPlaceholder}
          />
          <p className="text-dc-muted text-xs mt-1.5">{m.emailHelp}</p>
        </div>
        {emailStatus.error && <p className={errorClass}>{emailStatus.error}</p>}
        {emailStatus.success && <p className={successClass}>{emailStatus.success}</p>}
        <button type="submit" disabled={loading || email.trim() === savedEmail} className={primaryButtonClass}>{m.save}</button>
      </form>

      {/* Replié par défaut : les champs n'apparaissent que si on veut changer de mot de passe. */}
      <details className="group bg-dc-surface border border-dc-border rounded-2xl">
        <summary className="flex items-center justify-between gap-2 cursor-pointer list-none p-6 font-fantasy text-lg text-dc-text [&::-webkit-details-marker]:hidden">
          {m.passwordTitle}
          <ChevronDown className="w-5 h-5 text-dc-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <form onSubmit={savePassword} className="px-6 pb-6 space-y-4">
          <div>
            <label className={labelClass} htmlFor="current">{m.currentPassword}</label>
            <input id="current" type="password" className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className={labelClass} htmlFor="new">{m.newPassword}</label>
            <input id="new" type="password" className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className={labelClass} htmlFor="confirm">{m.confirm}</label>
            <input id="confirm" type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {passwordStatus.error && <p className={errorClass}>{passwordStatus.error}</p>}
          {passwordStatus.success && <p className={successClass}>{passwordStatus.success}</p>}
          <button type="submit" disabled={loading || !currentPassword || !newPassword} className={primaryButtonClass}>
            {m.changePassword}
          </button>
        </form>
      </details>
    </div>
  )
}
