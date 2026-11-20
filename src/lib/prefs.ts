/*
 * Preferences kept on this device only (localStorage), like the theme and the Days/Stream layout. They are not part of
 * the journal and do not sync.
 */

/** "Show the time between entries": the dashed "+1 h 20 min" line between two entries of a day that are an hour or more apart. */
export const SHOW_GAPS_KEY = 'showGaps'

/** On unless the stored value is "0", so a new device, cleared storage or an older version all show it. */
export const showGapsFromStored = (stored: string | null): boolean => stored !== '0'
export const showGapsToStored = (on: boolean): string => (on ? '1' : '0')
