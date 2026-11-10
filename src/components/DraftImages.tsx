import { useRef } from 'react'
import { MAX_IMAGES_PER_ENTRY } from '../lib/images'
import { Thumb } from './Thumb'
import type { DraftImages } from './useDraftImages'

/** The draft's photos as small removable chips, plus any message about them. */
export function DraftChips({ draft }: { draft: DraftImages }) {
  return (
    <>
      {draft.images.length > 0 && (
        <ul className="draft-images" aria-label="Attached photos">
          {draft.images.map((img) => (
            <li key={img.key} className={img.status}>
              {img.ref ? <Thumb image={img.ref} /> : <span className="thumb-placeholder">…</span>}
              <button type="button" className="remove" aria-label={`Remove ${img.name}`} title="Remove" onClick={() => draft.remove(img.key)}>×</button>
            </li>
          ))}
        </ul>
      )}
      {draft.notice && <p className="capture-notice" role="status">{draft.notice}</p>}
    </>
  )
}

/** "Photo" button with a hidden file picker (several at once; on Android it also offers the camera). */
export function AttachButton({ draft, onPicked }: { draft: DraftImages; onPicked?: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const full = draft.images.length >= MAX_IMAGES_PER_ENTRY
  return (
    <>
      <button
        type="button"
        className="ghost attach"
        onClick={() => input.current?.click()}
        disabled={full}
        title={full ? `Up to ${MAX_IMAGES_PER_ENTRY} photos per entry` : 'Attach photos (or paste / drop them)'}
        aria-label="Attach photos"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m21 16-5-5-8 8" />
        </svg>
        <span>Photo</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void draft.add([...(e.target.files ?? [])])
          e.target.value = '' // so picking the same file again still fires
          onPicked?.()
        }}
      />
    </>
  )
}
