'use client'

/** Confirmation dans la table : `confirm()` du navigateur ne s'affiche pas (ou fait sortir) en plein écran. */
export default function ConfirmModal({ message, label, onConfirm, onClose }: {
  message: string
  label: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}
        role="alertdialog" aria-modal="true" aria-label={message} data-testid="confirm">
        <p className="text-dc-text">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded-xl border border-dc-border text-dc-text" onClick={onClose}>Annuler</button>
          <button autoFocus className="px-4 py-2 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold" data-testid="confirm-ok"
            onClick={() => { onClose(); onConfirm() }}>{label}</button>
        </div>
      </div>
    </div>
  )
}
