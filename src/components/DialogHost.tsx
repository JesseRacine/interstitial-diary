import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { type DialogRequest, currentDialog, settleDialog, subscribe } from '../lib/dialog'

/** Shows the app's current question (lib/dialog.ts) as a modal box. Mount once. */
export function DialogHost() {
  const req = useSyncExternalStore(subscribe, currentDialog)
  return req ? <DialogBox key={req.id} req={req} /> : null
}

function DialogBox({ req }: { req: DialogRequest }) {
  const box = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const okButton = useRef<HTMLButtonElement>(null)
  const [text, setText] = useState(req.value)
  // Where the person was before the question: read while rendering, before the box opens and takes the focus.
  const [before] = useState(() => document.activeElement as HTMLElement | null)

  const cancel = () => settleDialog(req, req.kind === 'confirm' ? false : req.kind === 'prompt' ? null : undefined)
  const ok = () => settleDialog(req, req.kind === 'confirm' ? true : req.kind === 'prompt' ? text : undefined)

  useEffect(() => {
    const d = box.current
    if (d && !d.open) d.showModal() // a modal: the page behind cannot be clicked or tabbed into
    // The safe default: the text for a question with an answer, Cancel for a destructive one, otherwise the main button.
    if (req.kind === 'prompt') { field.current?.focus(); field.current?.select() }
    else if (req.danger) cancelButton.current?.focus()
    else okButton.current?.focus()
    return () => { if (before?.isConnected) before.focus() } // hand the focus back to where the person was
  }, [req, before])

  return (
    <dialog ref={box} className="app-dialog" aria-label={req.message} onCancel={(e) => { e.preventDefault(); cancel() }}>
      <form onSubmit={(e) => { e.preventDefault(); ok() }}>
        <p className="app-dialog-message">{req.message}</p>
        {req.kind === 'prompt' && (
          <input ref={field} type="text" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} aria-label={req.message} />
        )}
        <div className="app-dialog-buttons">
          {req.kind !== 'alert' && <button type="button" ref={cancelButton} onClick={cancel}>Cancel</button>}
          <button type="submit" ref={okButton} className={`primary${req.danger ? ' danger' : ''}`}>{req.confirmLabel}</button>
        </div>
      </form>
    </dialog>
  )
}
