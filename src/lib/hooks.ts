import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
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
