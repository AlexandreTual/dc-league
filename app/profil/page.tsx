import { redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { getUserById } from '@/lib/db-auth'
import { getMessages } from '@/lib/i18n/server'
import ProfileForms from './ProfileForms'

export const runtime = 'edge'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/connexion?from=/profil')
  if (user.isBootstrap) redirect('/admin')
  const { env } = getRequestContext<CloudflareEnv>()
  const [{ data: account }, t] = await Promise.all([getUserById(env.DB, user.id), getMessages()])

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-fantasy text-2xl font-bold text-dc-gold">{t.account.profile.title}</h1>
        <p className="text-dc-muted text-sm">{t.account.profile.signedInAs(user.username)}</p>
      </div>
      <ProfileForms initialName={user.playerName} initialAvatarUrl={user.avatarUrl ?? ''} initialEmail={account?.email ?? ''} />
    </div>
  )
}
