import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import ProfileForms from './ProfileForms'

export const runtime = 'edge'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/connexion?from=/profil')
  if (user.isBootstrap) redirect('/admin')

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Mon profil</h1>
        <p className="text-dc-muted text-sm">Connecté en tant que @{user.username}</p>
      </div>
      <ProfileForms initialName={user.playerName} initialAvatarUrl={user.avatarUrl ?? ''} />
    </div>
  )
}
