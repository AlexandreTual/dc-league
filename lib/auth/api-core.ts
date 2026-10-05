import { NextResponse } from 'next/server'
import { assertSameOrigin } from './origin'
import type { CurrentUser } from './types'

export const INTERNAL_ERROR = 'Erreur interne, réessaie plus tard'

/** public : sans session ; user : connecté ; player : vrai compte joueur ; admin : admin ou session de démarrage. */
export type Access = 'public' | 'user' | 'player' | 'admin'

export type ApiContext = {
  db: D1Database
  env: CloudflareEnv
  /** null seulement pour une route publique. */
  user: CurrentUser | null
  /** Corps JSON (objet), vide pour une lecture. */
  body: Record<string, unknown>
}

export type ApiDeps = { getUser: () => Promise<CurrentUser | null>; getEnv: () => CloudflareEnv }

const json = (error: string, status: number) => NextResponse.json({ error }, { status })

export const badRequest = (error: string) => json(error, 400)
export const conflict = (error: string) => json(error, 409)

/** Erreur de base : détail journalisé côté serveur, message générique en français côté client. */
export function dbFailure(detail: unknown): NextResponse {
  console.error('[api]', detail)
  return json(INTERNAL_ERROR, 500)
}

/**
 * Erreur d'un résultat de base : les messages métier connus partent avec leur statut (400, 404, 409…),
 * tout le reste (message brut de D1) devient une 500 générique.
 */
export function resultError(error: string, known: Readonly<Record<string, number>> = {}): NextResponse {
  const status = known[error]
  return status ? json(error, status) : dbFailure(error)
}

function checkAccess(access: Access, user: CurrentUser | null): NextResponse | null {
  if (access === 'public') return null
  if (!user) return json(access === 'admin' ? 'Non autorisé' : 'Connexion requise', 401)
  if (access === 'admin' && !user.isAdmin && !user.isBootstrap) return json('Accès réservé aux admins', 403)
  if (access === 'player' && user.isBootstrap) return json('Crée ton compte avant de modifier un profil', 403)
  return null
}

/** Corps JSON : vide → {} ; illisible ou autre chose qu'un objet → null. */
async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  if (req.method === 'GET' || req.method === 'HEAD') return {}
  const text = await req.text()
  if (!text.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Socle commun des routes API : contrôle d'origine sur les écritures, droits, lecture JSON tolérante,
 * et toute exception transformée en 500 générique en français (détail journalisé).
 */
export async function handleApi(
  req: Request,
  access: Access,
  run: (ctx: ApiContext) => Promise<NextResponse>,
  deps: ApiDeps,
): Promise<NextResponse> {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const refused = assertSameOrigin(req)
      if (refused) return refused
    }
    const user = access === 'public' ? null : await deps.getUser()
    const denied = checkAccess(access, user)
    if (denied) return denied
    const body = await readBody(req)
    if (!body) return badRequest('Requête invalide')
    const env = deps.getEnv()
    return await run({ db: env.DB, env, user, body })
  } catch (e) {
    return dbFailure(e)
  }
}
