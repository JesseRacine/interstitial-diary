import { createContext, useContext } from 'react'
import type { Entry } from '../lib/entry'

/**
 * How an event chip in an entry opens that event's page. App provides it; EntryItem reads it, so the chip works
 * everywhere an entry is shown (journal, search results, tag pages, event pages) without passing a prop through each.
 * Without a provider the chip is plain text.
 */
export type OpenEvent = (entry: Entry, title: string) => void

export const OpenEventContext = createContext<OpenEvent | null>(null)

export const useOpenEvent = (): OpenEvent | null => useContext(OpenEventContext)
