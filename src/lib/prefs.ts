/*
 * Preferences kept on this device only (localStorage), like the theme and the Days/Stream layout. They are not part of
 * the journal and do not sync.
 */

/**
 * "Text size": the size of all text, as a share of the browser's own default (16 px). It sets the page's root font size, which
 * every `rem` length in the stylesheet follows, so the whole layout scales with the text like a browser's text zoom.
 */
export const TEXT_SIZE_KEY = 'textSize'
export type TextSize = 'small' | 'normal' | 'large' | 'xlarge'
export const TEXT_SIZES: { id: TextSize; label: string; percent: number }[] = [
  { id: 'small', label: 'Small', percent: 90 },
  { id: 'normal', label: 'Normal', percent: 100 },
  { id: 'large', label: 'Large', percent: 115 },
  { id: 'xlarge', label: 'Extra large', percent: 135 },
]

/** Normal unless the stored value names a size, so a new device, cleared storage or a value from another version is normal. */
export const textSizeFromStored = (stored: string | null): TextSize => TEXT_SIZES.find((t) => t.id === stored)?.id ?? 'normal'

/** Set the size on the page's root element. Normal removes the setting, so the browser's own default size applies. */
export function applyTextSize(root: { style: { fontSize: string } }, size: TextSize): void {
  const percent = TEXT_SIZES.find((t) => t.id === size)?.percent ?? 100
  root.style.fontSize = percent === 100 ? '' : `${percent}%`
}

/** "Show the time between entries": the dashed "+1 h 20 min" line between two entries of a day that are an hour or more apart. */
export const SHOW_GAPS_KEY = 'showGaps'

/** On unless the stored value is "0", so a new device, cleared storage or an older version all show it. */
export const showGapsFromStored = (stored: string | null): boolean => stored !== '0'
export const showGapsToStored = (on: boolean): string => (on ? '1' : '0')
