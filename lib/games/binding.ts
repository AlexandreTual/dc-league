/** Durable Object de la table, joint par la liaison GAME du site. */
export function gameStub(env: { GAME: DurableObjectNamespace }, tableId: string): DurableObjectStub {
  return env.GAME.get(env.GAME.idFromName(tableId))
}

/** Supprime la partie d'une table (route DELETE du Worker de jeu) ; true si elle est acceptée. */
export function destroyGame(env: { GAME: DurableObjectNamespace }): (tableId: string) => Promise<boolean> {
  return async (tableId) => (await gameStub(env, tableId).fetch(`https://game/tables/${tableId}`, { method: 'DELETE' })).ok
}
