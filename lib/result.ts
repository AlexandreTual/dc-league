// Résultat d'une requête en base : la donnée, ou le message d'erreur. Partagé par tous les lib/db-*.ts
// (et par le Worker de jeu, via lib/db-games.ts : fichier listé dans deploy-game-worker.yml).

export type Ok<T> = { data: T; error: null }
export type Err = { data: null; error: string }
export type Result<T> = Ok<T> | Err

export function ok<T>(data: T): Ok<T> {
  return { data, error: null }
}

export function err(msg: string): Err {
  return { data: null, error: msg }
}
