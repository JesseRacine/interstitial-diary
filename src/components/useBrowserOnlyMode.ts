import { browserOnlyMode } from '../lib/dataSafety'
import { backendById } from '../storage/backends'
import { useStorage } from '../storage/manager'

/** Whether the data is only in this browser (null: a storage outside it holds a copy, or the saved storage isn't read yet). */
export function useBrowserOnlyMode() {
  const s = useStorage()
  if (!s.restored) return null
  return browserOnlyMode(s.backendId, !!(s.backendId && backendById(s.backendId)?.insideBrowser))
}
