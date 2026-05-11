'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Eye, EyeOff } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/admin')
        router.refresh()
      } else {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Erreur de connexion')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-dc-gold" />
          </div>
          <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Administration</h1>
          <p className="text-dc-muted text-sm">Espace réservé à l&apos;administrateur de la ligue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="bg-dc-surface border border-dc-border rounded-2xl p-6 space-y-4">
            <div className="relative">
              <label className="block text-dc-muted text-xs mb-1.5">Mot de passe admin</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 pr-10 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dc-muted hover:text-dc-text transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-dc-red-light text-sm text-center bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!password || loading}
              className="w-full bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold font-fantasy font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Connexion…' : 'Entrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
