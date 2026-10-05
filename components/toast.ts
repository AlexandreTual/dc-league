/**
 * Affiche un message temporaire. Chaque nouveau message annule le minuteur du précédent,
 * pour qu'un ancien minuteur n'efface pas le message suivant trop tôt.
 */
export function createToaster(setMessage: (msg: string) => void, delay = 3000) {
  let timer: ReturnType<typeof setTimeout> | null = null
  function dispose() {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return {
    show(msg: string) {
      dispose()
      setMessage(msg)
      timer = setTimeout(() => {
        timer = null
        setMessage('')
      }, delay)
    },
    dispose,
  }
}
