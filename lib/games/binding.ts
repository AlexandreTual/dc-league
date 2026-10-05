/** Durable Object de la table, joint par la liaison GAME du site. */
export function gameStub(env: { GAME: DurableObjectNamespace }, tableId: string): DurableObjectStub {
  return env.GAME.get(env.GAME.idFromName(tableId))
}
