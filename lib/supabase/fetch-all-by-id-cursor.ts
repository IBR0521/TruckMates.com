/**
 * Cursor pagination by primary `id` to avoid `.limit(10000)` OOM in server actions.
 */
const DEFAULT_PAGE_SIZE = 500
const DEFAULT_MAX_ROWS = 50000

export async function fetchAllRowsByIdCursor<T extends { id: string }>(
  fetchPage: (args: { lastId: string | null; pageSize: number }) => Promise<{
    data: T[] | null
    error: { message?: string } | null
  }>,
  options?: { pageSize?: number; maxRows?: number; warnLabel?: string },
): Promise<{ rows: T[]; error: string | null }> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS
  const rows: T[] = []
  let lastId: string | null = null
  let hasMore = true
  while (hasMore) {
    const { data, error } = await fetchPage({ lastId, pageSize })
    if (error) {
      return { rows: [], error: error.message || "Query failed" }
    }
    const chunk = data || []
    if (chunk.length === 0) {
      break
    }
    rows.push(...chunk)
    lastId = chunk[chunk.length - 1].id
    if (chunk.length < pageSize) {
      hasMore = false
    }
    if (rows.length >= maxRows) {
      console.warn(
        options?.warnLabel
          ? `Pagination safety cap reached at ${maxRows} rows (${options.warnLabel})`
          : `Pagination safety cap reached at ${maxRows} rows`,
      )
      break
    }
  }
  return { rows, error: null }
}
