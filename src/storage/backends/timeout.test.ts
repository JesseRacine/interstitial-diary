import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dropboxStore, requestTimeoutMs } from './dropbox-store'
import { RequestTimeoutError, bodyBytes, fetchWithTimeout } from './timeout'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

/** A fetch like the real one for a connection that goes silent: it never answers, and fails only if aborted. */
const silentFetch = (): typeof fetch => (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
  })

/** Answers at once, but the body never finishes; aborting the request fails the body, like the real fetch. */
const stuckBodyFetch = (): typeof fetch => async (_input, init) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(init.signal!.reason), { once: true })
    },
  })
  return new Response(body, { status: 200 })
}

describe('fetchWithTimeout', () => {
  it('passes a normal answer through, with an abort signal added', async () => {
    let seen: RequestInit | undefined
    const f = fetchWithTimeout(async (_u, init) => { seen = init; return new Response('ok') }, 'Dropbox', () => 1000)
    const res = await f('https://x.test/', { method: 'POST' })
    expect(await res.text()).toBe('ok')
    expect(seen?.method).toBe('POST')
    expect(seen?.signal).toBeInstanceOf(AbortSignal)
  })

  it('gives up on a request that never answers, with a message that says what and when', async () => {
    const f = fetchWithTimeout(silentFetch(), 'Dropbox', () => 45_000)
    const p = f('https://x.test/')
    const assertion = expect(p).rejects.toThrow(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(45_000)
    await assertion
    await expect(p).rejects.toThrow('Dropbox did not answer within 45 seconds. It will try again.')
  })

  it('does not give up before the time is over', async () => {
    const f = fetchWithTimeout(silentFetch(), 'Dropbox', () => 45_000)
    let settled = false
    void f('https://x.test/').then(() => { settled = true }, () => { settled = true })
    await vi.advanceTimersByTimeAsync(44_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
  })

  it('also gives up when the answer starts but the body never finishes', async () => {
    const f = fetchWithTimeout(stuckBodyFetch(), 'Dropbox', () => 10_000)
    const res = await f('https://x.test/')
    const reading = res.text()
    const assertion = expect(reading).rejects.toThrow(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
  })

  it('a request that fails by itself keeps its own error, and nothing is left to fire later', async () => {
    const boom = new TypeError('Failed to fetch')
    const f = fetchWithTimeout(async () => { throw boom }, 'Dropbox', () => 10_000)
    await expect(f('https://x.test/')).rejects.toBe(boom)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still honours a signal the caller passed in', async () => {
    const outer = new AbortController()
    const f = fetchWithTimeout(silentFetch(), 'Dropbox', () => 45_000)
    const p = f('https://x.test/', { signal: outer.signal })
    const why = new Error('stopped by the caller')
    outer.abort(why)
    await expect(p).rejects.toBe(why)
  })

  it('bodyBytes counts strings, blobs and byte arrays', () => {
    expect(bodyBytes(undefined)).toBe(0)
    expect(bodyBytes('abc')).toBe(3)
    expect(bodyBytes(new Blob([new Uint8Array(10)]))).toBe(10)
    expect(bodyBytes(new Uint8Array(7))).toBe(7)
  })
})

describe('Dropbox request timeouts', () => {
  it('small calls get 45 seconds; photo calls get 2 minutes plus time for the bytes', () => {
    expect(requestTimeoutMs('https://api.dropboxapi.com/2/files/list_folder')).toBe(45_000)
    expect(requestTimeoutMs('https://content.dropboxapi.com/2/files/download')).toBe(120_000)
    // 10 MB at 20 KB/s is 500 seconds more
    expect(requestTimeoutMs('https://content.dropboxapi.com/2/files/upload', { body: new Uint8Array(10_000_000) })).toBe(620_000)
  })

  it('a Dropbox that stops answering fails the call instead of hanging, and the next call works', async () => {
    let silent = true
    const answer = (): Response => new Response(JSON.stringify({ entries: [], cursor: 'c', has_more: false }), { status: 200 })
    const fetchFn: typeof fetch = (input, init) => (silent ? silentFetch()(input, init) : Promise.resolve(answer()))
    const store = dropboxStore({ token: async () => 't', fetch: fetchFn })

    const first = store.list()
    const assertion = expect(first).rejects.toThrow(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(45_000)
    await assertion

    silent = false
    await expect(store.list()).resolves.toEqual([])
  })
})
