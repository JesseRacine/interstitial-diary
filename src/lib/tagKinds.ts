/**
 * The kinds of tag an entry's text can contain. Each kind has its own symbol: `#work`, `@sarah_jones`, `~home`.
 * Adding a kind (say projects with `+`) means adding one row here; reading, renaming and the stored keys all loop
 * over this list.
 *
 * Stored key: a plain tag is stored as its bare name (`work`), exactly as before kinds existed, so old data, saved
 * searches and the `*tags` index are unchanged. Every other kind is stored with its symbol in front (`@sarah_jones`),
 * which can never clash with a plain tag because a plain tag never starts with a symbol.
 */
export interface TagKind {
  id: string
  sigil: string // the character typed in the text
  prefix: string // put in front of the name in the stored key ('' for plain tags)
  label: string // singular, for headings and hints
  plural: string
  icon: string
  className: string // CSS class for the clickable tag in an entry
  letterFirst: boolean // the name must start with a letter (so "~5 min" and "@3pm" are not tags)
  pretty: boolean // show "sarah_jones" as "Sarah Jones"
}

export const TAG_KINDS: readonly TagKind[] = [
  { id: 'tag', sigil: '#', prefix: '', label: 'Tag', plural: 'Tags', icon: '#', className: 'tag', letterFirst: false, pretty: false },
  { id: 'person', sigil: '@', prefix: '@', label: 'Person', plural: 'People', icon: '👤', className: 'tag tag-person', letterFirst: true, pretty: true },
  { id: 'place', sigil: '~', prefix: '~', label: 'Place', plural: 'Places', icon: '📍', className: 'tag tag-place', letterFirst: true, pretty: true },
]

const PLAIN = TAG_KINDS[0]

/** The kind a stored key belongs to. */
export function tagKindOf(key: string): TagKind {
  return TAG_KINDS.find((k) => k.prefix && key.startsWith(k.prefix)) ?? PLAIN
}

/** The kind that uses this symbol, if any. */
export const kindForSigil = (sigil: string): TagKind | undefined => TAG_KINDS.find((k) => k.sigil === sigil)

/** The name without its kind's prefix: `@sarah_jones` gives `sarah_jones`. */
export const tagName = (key: string): string => key.slice(tagKindOf(key).prefix.length)

/** Build the stored key for a name of a kind. */
export const tagKey = (kind: TagKind, name: string): string => kind.prefix + name.toLowerCase()

/** How the tag is typed in text and in search: `work` gives `#work`, `@sarah` stays `@sarah`. */
export const tagToken = (key: string): string => tagKindOf(key).sigil + tagName(key)

/** How the tag reads on screen: `@sarah_jones` gives "Sarah Jones"; plain tags are shown as written. */
export function displayName(key: string): string {
  const name = tagName(key)
  if (!tagKindOf(key).pretty) return name
  return name
    .split(/[_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase() + w.slice(1))
    .join(' ')
}
