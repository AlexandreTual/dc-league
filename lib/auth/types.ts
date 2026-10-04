export type CurrentUser = {
  id: string
  playerId: string
  username: string
  isAdmin: boolean
  playerName: string
  avatarUrl: string | null
  isBootstrap: boolean
}

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string }
