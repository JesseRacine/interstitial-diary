import { useState } from 'react'
import { SEARCH_SYNTAX, syntaxExamples } from '../search/syntax'

/** A short user manual: writing, tags, events, search, the tabs, and where your data lives. Static text. */
export function ManualCard() {
  const [open, setOpen] = useState(false)

  return (
    <div className="card manual">
      <h3>Manual</h3>
      <p className="muted">How to write entries, what the tags and other marks mean, and how to search.</p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide the manual' : 'Show the manual'}</button>

      {open && (
        <div className="manual-body">
          <h4>Writing an entry</h4>
          <ul>
            <li>Type in the box at the bottom of the Journal. The entry gets the time you save it.</li>
            <li><kbd>Enter</kbd> saves and <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a line. On a phone or tablet, Enter adds a line and the
              <strong> Save</strong> button saves.</li>
            <li>Entries are plain text: what you type is what is shown. Only the marks below turn into chips.</li>
            <li><strong>Photos:</strong> paste, drop, or use the Photo button (up to 10 per entry). An entry needs some text.</li>
            <li><strong>Edit</strong> an entry to change its text, its photos or its <strong>When</strong> (date and time, never in the
              future; changing the day moves the entry there). <kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves the edit, <kbd>Esc</kbd> cancels.</li>
            <li><strong>Delete</strong> hides an entry. It waits in Settings &gt; Deleted entries, where you can restore it or delete it
              permanently.</li>
          </ul>

          <h4>Tags, people and places</h4>
          <table>
            <tbody>
              <tr><td><code>#work</code></td><td>a tag</td></tr>
              <tr><td><code>@sarah_jones</code></td><td>a person, shown as “Sarah Jones” (use <code>_</code> for a space)</td></tr>
              <tr><td><code>~blue_door</code></td><td>a place, shown as “Blue Door”</td></tr>
            </tbody>
          </table>
          <ul>
            <li>Names can use letters, digits, <code>_</code>, <code>-</code> and <code>/</code>, and are not case-sensitive. A person or place
              must start with a letter (<code>~5 min</code> and <code>@3pm</code> are just text).</li>
            <li>The symbol must not touch a word before it: <code>C#</code> and <code>bob@example.com</code> are not tags.</li>
            <li><code>#sarah</code>, <code>@sarah</code> and <code>~sarah</code> are three different tags.</li>
            <li>While you type a symbol, up to six matching known names are suggested: <kbd>↑</kbd> <kbd>↓</kbd> to choose,
              <kbd>Tab</kbd> or <kbd>Enter</kbd> to accept, <kbd>Esc</kbd> to dismiss.</li>
            <li>Click a chip to search for it. The <strong>Tags</strong> tab lists them (Tags, People, Places) and can rename or merge
              one, which fixes every entry at once. A person or place has its own page.</li>
          </ul>

          <h4>Events</h4>
          <ul>
            <li>Name something that happened with <code>!&quot;Jack&apos;s 40th birthday&quot;</code>. The title goes in quotes and can have spaces
              (up to 120 characters, one line). The <code>!</code> must follow a space, the start of the text or an opening bracket.</li>
            <li>Add a date with <code>!&quot;Jack&apos;s 40th&quot; (2026-05-12)</code> (year-month-day). The same title and date is one event, however
              far apart you wrote about it.</li>
            <li>Without a date, entries with the same title within 7 days are one event; a longer gap is a new event with the same
              title.</li>
            <li>An event shows as a 🎉 chip. The <strong>Events</strong> tab lists them by date; open one to see its entries,
              <strong> Rename</strong> it, <strong>Merge into…</strong> another (to fix a typo), or search for it.</li>
          </ul>

          <h4>Search</h4>
          <p>Type in the search box at the top (or press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd>). Everything you type must match;
            combine freely, e.g. <code>#work tired time:13-17 last:30d</code>.</p>
          <table className="syntax">
            <tbody>
              {SEARCH_SYNTAX.map(([q, d]) => (
                <tr key={q}>
                  <td>{syntaxExamples(q).map((ex) => <code key={ex} className="ex">{ex}</code>)}</td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul>
            <li>Several examples in one row are separate things you can type.</li>
            <li>Words that do not match a filter name are searched as ordinary words. A filter with a bad value shows “Didn’t
              understand …” under the box.</li>
            <li>Tap a quick chip (Today, Last 7 days, Mornings, Weekends, With photos, …) to add or remove a filter. <kbd>☆</kbd>
              saves a search; saved and recent searches appear when the box is focused. <kbd>Esc</kbd> clears the search.</li>
            <li>Results are sorted by relevance when you typed words, otherwise newest first, and a bar chart shows when the matches
              happened.</li>
          </ul>

          <h4>The tabs</h4>
          <ul>
            <li><strong>Journal:</strong> your entries by day (Days or Stream layout). <kbd>←</kbd> <kbd>→</kbd> move between days,
              <kbd>t</kbd> jumps to the latest entry, <kbd>n</kbd> starts a new entry.</li>
            <li><strong>Calendar:</strong> Month, Year, or Week. Week is a weekly review: entries, days written, photos, the busiest day,
              time of day, the top tags, people and places, events, and a comparison with the week before.</li>
            <li><strong>Events, Tags:</strong> as described above.</li>
            <li><strong>Photos:</strong> every photo; its filter box takes the same search words, and the chips narrow by tag, person,
              place or year.</li>
            <li><strong>Settings:</strong> where entries are saved, backup, export, appearance, deleted entries and start over.</li>
          </ul>

          <h4>Your data</h4>
          <ul>
            <li>Entries are always kept in this browser. Under <strong>Where entries are saved</strong> you can also save them as files
              (a folder on your computer, or Dropbox) so other devices and other programs can use them.</li>
            <li>The files are Markdown, one per day (<code>2026/2026-11-08.md</code>), each entry under a
              <code>## 14:30</code> heading. You can edit them by hand. Deleting an entry from a file by hand does not delete it;
              delete in the app.</li>
            <li><strong>Export</strong> downloads everything as a .zip: a backup you can keep. Saving to Dropbox is not a backup on its own.</li>
            <li><strong>Start over</strong> erases the whole journal, here and in the storage; your other devices clear themselves
              the next time they sync.</li>
          </ul>
        </div>
      )}
    </div>
  )
}
