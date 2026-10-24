import { NextResponse } from 'next/server'
import { assertSameOrigin } from './origin'
import type { CurrentUser } from './types'
import type { Lang } from '@/lib/i18n/lang'
import { localizeError } from '@/lib/i18n/errors'
import { recordError } from '../db-errors'

export const INTERNAL_ERROR = 'Erreur interne, réessaie plus tard'

/**
 * public : sans session ; viewer : ouvert à tous, session lue si présente (contenu filtré selon qui consulte) ;
 * user : connecté ; player : vrai compte joueur ; admin : admin ou session de démarrage.
 */
export type Access = 'public' | 'viewer' | 'user' | 'player' | 'admin'

export type ApiContext = {
  db: D1Database
  env: CloudflareEnv
  /** null pour une route publique, ou un visiteur sur une route « viewer ». */
  user: CurrentUser | null
  /** Corps JSON (objet), vide pour une lecture. */
  body: Record<string, unknown>
}

export type ApiDeps = {
  getUser: () => Promise<CurrentUser | null>
  getEnv: () => CloudflareEnv
  /** Langue de la requête : les messages d'erreur (écrits en français) y sont traduits à la sortie. Absente : français. */
  getLang?: () => Promise<Lang>
}

const json = (error: string, status: number) => NextResponse.json({ error }, { status })

export const badRequest = (error: string) => json(error, 400)
export const conflict = (error: string) => json(error, 409)

/** Détail des 500 renvoyées par dbFailure, enregistré dans le journal des erreurs par handleApi. */
const failures = new WeakMap<Response, string>()

/** Erreur de base : détail journalisé côté serveur, message générique en français côté client. */
export function dbFailure(detail: unknown): NextResponse {
  console.error('[api]', detail)
  const res = json(INTERNAL_ERROR, 500)
  failures.set(res, detail instanceof Error ? detail.message : String(detail))
  return res
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
  if (access === 'public' || access === 'viewer') return null
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
 * toute exception transformée en 500 générique (détail journalisé, et enregistré dans le journal des erreurs
 * de l'administration), message d'erreur dans la langue de la requête.
 */
export async function handleApi(
  req: Request,
  access: Access,
  run: (ctx: ApiContext) => Promise<NextResponse>,
  deps: ApiDeps,
): Promise<NextResponse> {
  const seen: { user: CurrentUser | null } = { user: null }
  const res = await answer(req, access, run, deps, seen)
  const detail = failures.get(res)
  if (detail !== undefined) {
    try {
      const path = `${req.method} ${new URL(req.url).pathname}`
      const { error } = await recordError(deps.getEnv().DB, { source: 'serveur', message: detail, path, userId: seen.user?.id }, new Date())
      if (error !== null) console.error('[api] journal des erreurs indisponible', error)
    } catch (e) {
      console.error('[api] journal des erreurs indisponible', e)
    }
  }
  if (!deps.getLang || res.status < 400) return res
  const lang = await deps.getLang().catch((): Lang => 'fr')
  return localizeError(res, lang)
}

/** Réponse de la route ; `seen.user` reçoit le compte lu, pour le journal des erreurs. */
async function answer(
  req: Request,
  access: Access,
  run: (ctx: ApiContext) => Promise<NextResponse>,
  deps: ApiDeps,
  seen: { user: CurrentUser | null },
): Promise<NextResponse> {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const refused = assertSameOrigin(req)
      if (refused) return refused
    }
    const user = access === 'public' ? null : await deps.getUser()
    seen.user = user
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
