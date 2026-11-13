import { type Entry, dayKey, timeLabel, withDerived } from './entry'

/*
 * Editing an entry's time (and so maybe its day). createdAt is otherwise never changed, so this is the one place that
 * does it. The Markdown file needs no new syntax: the heading's `created:` stamp carries the new time. The catch is the
 * OLD day's file, which still lists the entry; `prevDay` tells the next sync to rewrite it (see storage/sync.ts).
 */

const MINUTE = 60_000

/**
 * The createdAt for a time picked to the minute (a date-time field has no seconds). The entry keeps its own seconds, so
 * entries in the same minute keep their order. Picking the minute it already has changes nothing.
 */
export function retimedCreatedAt(current: number, picked: number): number {
  const minute = Math.floor(picked / MINUTE)
  if (minute === Math.floor(current / MINUTE)) return current
  return minute * MINUTE + (current % MINUTE)
}

/** A timestamp as the value of an `<input type="datetime-local">`: local time, to the minute (`2026-11-08T09:14`). */
export function toDateTimeInput(ts: number): string {
  return `${dayKey(ts)}T${timeLabel(ts)}`
}

/** What such an input holds as a timestamp (local time); NaN while the field is empty or incomplete. */
export function fromDateTimeInput(value: string): number {
  return value ? new Date(value).getTime() : Number.NaN
}

/** A time an entry may be given: a real moment that is not in the future (an entry records something that happened). */
export function isAllowedTime(createdAt: number, now: number): boolean {
  return Number.isFinite(createdAt) && createdAt <= now
}

/**
 * The entry at a new time: derived fields recalculated, `updatedAt` stamped and marked changed, so it syncs like any
 * edit. If this moves it to another day, `prevDay` remembers the day it was last synced on (kept through further
 * moves, because the days in between never reached a file).
 */
export function retimeEntry(e: Entry, createdAt: number, updatedAt: number): Entry {
  const moved = dayKey(createdAt) !== e.day
  return withDerived({ ...e, createdAt, updatedAt, dirty: 1, prevDay: e.prevDay ?? (moved ? e.day : undefined) })
}
