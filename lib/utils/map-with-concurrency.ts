/**
 * Run async work over `items` with a fixed pool size (e.g. cron company batches).
 */
export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) break
      ret[idx] = await fn(items[idx]!)
    }
  }

  const n = Math.min(Math.max(1, concurrency), Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return ret
}
