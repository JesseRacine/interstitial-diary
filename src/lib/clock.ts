import { pad } from './entry'

/*
 * Times shown on screen follow the device's clock setting: 12-hour with AM/PM ("5:31 PM") or 24-hour ("17:31"). The
 * choice is read from the browser's locale, which follows the system (on Windows and Android the 12/24-hour setting
 * decides it). Dates are always written the US way (see `longDayLabel` in entry.ts). Times in the saved Markdown files and
 * in the Edit box's date field are not affected: the files keep `09:14`, and the field is the browser's own.
 */

const read12Hour = (locale?: string): boolean => {
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true
  } catch {
    return false
  }
}
let device: boolean | undefined

/**
 * Whether the device shows a 12-hour clock. Read once per page load (the screens ask on every render); a change of the
 * system setting shows after the app is reopened. `locale` is only for tests; omit it to use the device's.
 */
export function uses12HourClock(locale?: string): boolean {
  if (locale !== undefined) return read12Hour(locale)
  return (device ??= read12Hour())
}

/** A time of day as shown beside an entry: "5:31 PM" on a 12-hour clock, "17:31" on a 24-hour one. */
export function clockLabel(ts: number, twelve: boolean = uses12HourClock()): string {
  const d = new Date(ts)
  const h = d.getHours()
  if (!twelve) return `${pad(h)}:${pad(d.getMinutes())}`
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}

/** A whole hour (0 to 24) as shown in the week review: "6 PM" or "18". */
export function hourName(h: number, twelve: boolean = uses12HourClock()): string {
  if (!twelve) return String(h)
  const hh = h % 24
  return `${hh % 12 || 12} ${hh < 12 ? 'AM' : 'PM'}`
}

/** The hours a part of the day covers: "6 AM–12 PM" or "6–12". */
export function hourRange(from: number, to: number, twelve: boolean = uses12HourClock()): string {
  return `${hourName(from, twelve)}–${hourName(to, twelve)}`
}

/**
 * A whole hour as typed in the search bar (`time:5am-12pm` or `time:05-12`). Both forms always work when typed; the
 * quick chips use the one the device's clock uses.
 */
export function searchHour(h: number, twelve: boolean = uses12HourClock()): string {
  if (!twelve) return pad(h)
  const hh = h % 24
  return `${hh % 12 || 12}${hh < 12 ? 'am' : 'pm'}`
}
