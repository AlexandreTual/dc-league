// Table sur écran tactile : appui long (équivalent du clic droit), position du menu et de l'aperçu.
// Les fonctions de calcul sont pures ; menuGesture les branche sur les événements du navigateur.

/** Durée d'un appui long, et déplacement du doigt au-delà duquel il est annulé. */
export const LONG_PRESS_MS = 450
export const LONG_PRESS_TOLERANCE = 8

/** Point où ouvrir un menu (clic droit ou appui long) ; `touch` : ouvert par un appui long au doigt. */
export type MenuPoint = { clientX: number; clientY: number; touch?: boolean }

/** Minuterie d'appui long : déclenchée après `delay` si le doigt n'a pas bougé de plus de `tolerance` px. */
export function createLongPress(onFire: (x: number, y: number) => void, delay = LONG_PRESS_MS, tolerance = LONG_PRESS_TOLERANCE) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let origin: { x: number; y: number } | null = null
  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    origin = null
  }
  return {
    start(x: number, y: number) {
      cancel()
      const at = { x, y }
      origin = at
      timer = setTimeout(() => {
        timer = null
        origin = null
        onFire(at.x, at.y)
      }, delay)
    },
    move(x: number, y: number) {
      if (origin && Math.hypot(x - origin.x, y - origin.y) > tolerance) cancel()
    },
    cancel,
  }
}

type Size = { width: number; height: number }
const MARGIN = 8

/** Menu au pointeur, gardé dans l'écran : jamais au-dessus du bord haut, hauteur bornée (défilement interne). */
export function menuPosition(at: { x: number; y: number }, menu: Size, screen: Size) {
  const maxHeight = screen.height - 2 * MARGIN
  const height = Math.min(menu.height, maxHeight)
  return {
    left: Math.max(MARGIN, Math.min(at.x, screen.width - menu.width - MARGIN)),
    top: Math.max(MARGIN, Math.min(at.y, screen.height - height - MARGIN)),
    maxHeight,
  }
}

/** Largeur de l'aperçu sur grand écran (w-72) ; en dessous de ces dimensions, il est centré et borné. */
export const PREVIEW_WIDTH = 288
const SMALL_WIDTH = 640
const SMALL_HEIGHT = 480
const PREVIEW_MARGIN = 16
const CARD_RATIO = 63 / 88

/**
 * Aperçu sur petit écran : centré, au format d'une carte, dans l'écran ; null sur grand écran (place habituelle).
 * Sert à la souris dans une fenêtre étroite (moins de 640 × 480) : au doigt, l'aperçu au survol est masqué
 * (l'image est dans le menu de la carte) et le téléphone n'est plus une cible de la table.
 */
export function previewBox(screen: Size): { left: number; top: number; width: number; height: number } | null {
  if (screen.width >= SMALL_WIDTH && screen.height >= SMALL_HEIGHT) return null
  const width = Math.min(PREVIEW_WIDTH, screen.width - 2 * PREVIEW_MARGIN, (screen.height - 2 * PREVIEW_MARGIN) * CARD_RATIO)
  const height = width / CARD_RATIO
  return { left: (screen.width - width) / 2, top: (screen.height - height) / 2, width, height }
}

/** Événements déjà pris en charge par un élément intérieur (une carte dans la main, par exemple). */
const claimed = new WeakSet<Event>()
/** Dernier appui long : le menu contextuel natif qui le suit (Android) est ignoré. */
let lastLongPress = 0
const SAME_GESTURE_MS = 1000
/** Délai entre le lever du doigt et le clic qu'il émet, au-delà duquel un clic est un vrai toucher. */
const CLICK_AFTER_LIFT_MS = 300

/**
 * Annule un glisser dnd-kit en cours ou en attente : ses capteurs écoutent Échap (event.code) sur le document.
 * `key` est laissé vide pour ne pas déclencher le raccourci « fermer » de la table.
 */
function cancelDrag() {
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: '', bubbles: true }))
}

/** Le clic émis au lever du doigt ne doit pas choisir une entrée du menu qui vient de s'ouvrir dessous. */
function swallowNextClick() {
  const done = () => {
    window.removeEventListener('click', swallow, true)
    window.removeEventListener('pointerup', lifted, true)
    window.removeEventListener('pointercancel', lifted, true)
  }
  const swallow = (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
    done()
  }
  // Le doigt peut rester posé longtemps : on attend qu'il se lève, puis le clic qui suit de peu.
  const lifted = () => setTimeout(done, CLICK_AFTER_LIFT_MS)
  window.addEventListener('click', swallow, true)
  window.addEventListener('pointerup', lifted, true)
  window.addEventListener('pointercancel', lifted, true)
}

/** Un seul doigt à la fois : un appui long en cours au plus, et le menu qu'il ouvrira. */
let pendingOpen: ((at: MenuPoint) => void) | null = null
let press: ReturnType<typeof createLongPress> | null = null

function stopPress() {
  press?.cancel()
  pendingOpen = null
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', stopPress)
  window.removeEventListener('pointercancel', stopPress)
}

function onWindowMove(e: PointerEvent) {
  press?.move(e.clientX, e.clientY)
}

/** Fin de l'appui long : le glisser éventuel est annulé, puis le menu s'ouvre. */
function firePress(x: number, y: number) {
  const fire = pendingOpen
  stopPress()
  lastLongPress = Date.now()
  cancelDrag()
  swallowNextClick()
  fire?.({ clientX: x, clientY: y, touch: true })
}

function startPress(x: number, y: number, open: (at: MenuPoint) => void) {
  press ??= createLongPress(firePress)
  stopPress()
  pendingOpen = open
  press.start(x, y)
  // Suivi sur la fenêtre : le doigt peut quitter l'élément, ou l'élément disparaître.
  window.addEventListener('pointermove', onWindowMove)
  window.addEventListener('pointerup', stopPress)
  window.addEventListener('pointercancel', stopPress)
}

/**
 * Gestionnaires qui ouvrent le même menu au clic droit et à l'appui long (doigt ou stylet ;
 * la souris garde le clic droit). Sans `open`, aucun : l'élément reste sans menu.
 * L'élément le plus intérieur l'emporte (une carte dans la main ouvre le menu de la carte).
 */
export function menuGesture(open?: (at: MenuPoint) => void) {
  if (!open) return {}
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' || claimed.has(e.nativeEvent)) return
      claimed.add(e.nativeEvent)
      startPress(e.clientX, e.clientY, open)
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      if (claimed.has(e.nativeEvent)) return
      claimed.add(e.nativeEvent)
      // Android émet aussi « contextmenu » à l'appui long : après notre délai, le menu est déjà ouvert ;
      // avant (délai système plus court), il termine l'appui long en cours, glisser compris.
      if (Date.now() - lastLongPress < SAME_GESTURE_MS) return
      if (pendingOpen) return firePress(e.clientX, e.clientY)
      open({ clientX: e.clientX, clientY: e.clientY })
    },
  }
}

/** Classes communes aux éléments à appui long : pas de bulle iOS ni de sélection de texte. */
export const longPressClass = 'select-none [-webkit-touch-callout:none]'

/** Cible tactile d'au moins 32 px sur écran tactile (pointer: coarse), sans changer l'affichage à la souris. */
export const touchTarget = '[@media(pointer:coarse)]:min-w-8 [@media(pointer:coarse)]:min-h-8 [@media(pointer:coarse)]:inline-flex [@media(pointer:coarse)]:items-center [@media(pointer:coarse)]:justify-center'
