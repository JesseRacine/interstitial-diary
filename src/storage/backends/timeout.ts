/*
 * A `fetch` that gives up. Without this, a request that never answers (the phone went to sleep or lost the
 * network mid-request, a connection that silently died) leaves the promise pending forever: the sync never ends, every
 * later sync just waits for it, and Settings shows "Saving…" until the app is closed.
 *
 * The timer runs for the whole request, including reading the body: aborting a signal also fails a body that is still
 * being read, with the signal's reason (our error). After the request has finished the abort does nothing.
 */

export class RequestTimeoutError extends Error {
  readonly timeoutMs: number
  constructor(what: string, timeoutMs: number) {
    super(`${what} did not answer within ${Math.round(timeoutMs / 1000)} seconds. It will try again.`)
    this.name = 'RequestTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

const urlOf = (input: Parameters<typeof fetch>[0]) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

/** How many bytes a request sends (0 when unknown): longer uploads get longer. */
export function bodyBytes(body: RequestInit['body'] | undefined): number {
  if (!body) return 0
  if (typeof body === 'string') return body.length
  if (body instanceof Blob) return body.size
  if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer) return body.byteLength
  return 0
}

/** `fetchFn`, but it fails with a `RequestTimeoutError` when the request (headers and body) takes longer than `timeoutMs`. */
export function fetchWithTimeout(
  fetchFn: typeof fetch, what: string, timeoutMs: (url: string, init?: RequestInit) => number,
): typeof fetch {
  return async (input, init) => {
    const ms = timeoutMs(urlOf(input), init)
    const controller = new AbortController()
    const reason = new RequestTimeoutError(what, ms)
    const timer = setTimeout(() => controller.abort(reason), ms)
    const outer = init?.signal
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason)
      else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true })
    }
    try {
      return await fetchFn(input, { ...init, signal: controller.signal })
    } catch (e) {
      clearTimeout(timer)
      throw controller.signal.aborted && controller.signal.reason === reason ? reason : e
    }
    // On success the timer stays: it still guards reading the body, and does nothing once that has finished.
  }
}
