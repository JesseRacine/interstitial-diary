// The URL path the built app is served from. Local dev and preview use "/"; GitHub Pages serves a project site from
// "/<repo>/", and the deploy workflow passes that in the BASE_PATH environment variable (see vite.config.ts).
// Lives in its own file so a test can check the rules.

/**
 * Turns the BASE_PATH setting into the form Vite expects: starts and ends with "/".
 * Unset or empty means "/" (the app at the root of the address). Anything that is not a plain path (a full URL, a
 * query, a fragment, spaces, "..") is rejected, so a typo in the workflow fails the build instead of shipping a site
 * whose scripts and icons 404.
 */
export function normaliseBase(value: string | undefined): string {
  const raw = (value ?? '').trim()
  if (raw === '' || raw === '/') return '/'
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
    throw new Error(`BASE_PATH must be a path such as "/my-repo/", not a URL: "${raw}"`)
  }
  if (/[\s?#\\]/.test(raw) || raw.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`BASE_PATH is not a plain path: "${raw}"`)
  }
  const squeezed = raw.replace(/\/{2,}/g, '/')
  return `${squeezed.startsWith('/') ? '' : '/'}${squeezed}${squeezed.endsWith('/') ? '' : '/'}`
}
