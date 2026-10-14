import { redirect } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import ForgotForm from './ForgotForm'

export const runtime = 'edge'

export default async function MotDePasseOubliePage() {
  if (await getCurrentUser()) redirect('/profil')

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8 text-dc-gold" />
          </div>
          <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Mot de passe oublié</h1>
          <p className="text-dc-muted text-sm">Reçois par mail un lien pour choisir un nouveau mot de passe</p>
        </div>
        <ForgotForm />
      </div>
    </div>
  )
}
