import { liveQuery } from 'dexie'
import { useEffect, useLayoutEffect, useState } from 'react'
import { hasCoarsePointer } from './dom'

/** Subscribe to a Dexie query; re-renders whenever the underlying tables change. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: (e) => console.error(e) })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}

/**
 * Make a text box as tall as its text, counting lines that wrap on their own (not only typed line breaks), so a long
 * sentence never ends up in a one-line box that scrolls inside itself. A CSS `max-height` caps the growth; past it the
 * box scrolls. `rows` stays the smallest height.
 */
export function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto' // shrink to `rows` first, so deleting text makes the box smaller again
      const border = el.offsetHeight - el.clientHeight
      el.style.height = `${el.scrollHeight + border}px`
    }
    fit()
    window.addEventListener('resize', fit) // a narrower box wraps into more lines (turning the phone, resizing the window)
    return () => window.removeEventListener('resize', fit)
  }, [ref, value])
}

/** Whether the main pointer is a finger (a phone or tablet); follows changes such as docking a keyboard and mouse. */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(hasCoarsePointer)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(pointer: coarse)')
    const onChange = () => setCoarse(mq.matches)
    mq.addEventListener('change', onChange)
    onChange()
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return coarse
}
