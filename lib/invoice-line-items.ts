/**
 * Align line-item rate/amount with invoice total when JSON rows are stale (e.g. zeros)
 * or sums don't match `amount`.
 */
export type InvoiceLineItem = {
  description?: string
  quantity?: number
  rate?: number
  amount?: number
}

export function normalizeInvoiceLineItems(
  raw: unknown,
  invoiceAmount: number,
): Array<{ description: string; quantity: number; rate: number; amount: number }> {
  const total = Number(invoiceAmount) || 0
  const rows: InvoiceLineItem[] = Array.isArray(raw) ? raw : []
  if (rows.length === 0) {
    return [{ description: "Service", quantity: 1, rate: total, amount: total }]
  }

  const normalized = rows.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1)
    const amount = Number(item.amount ?? 0)
    const rate = Number(item.rate ?? (qty ? amount / qty : 0))
    return {
      description: String(item.description || "Item"),
      quantity: qty,
      rate,
      amount,
    }
  })

  const sum = normalized.reduce((s, r) => s + r.amount, 0)
  if (total <= 0 || Math.abs(sum - total) < 0.01) {
    return normalized
  }

  if (normalized.length === 1) {
    const r = normalized[0]
    return [
      {
        description: r.description,
        quantity: r.quantity,
        rate: total / r.quantity,
        amount: total,
      },
    ]
  }

  if (sum > 0.01) {
    const scale = total / sum
    return normalized.map((r) => ({
      description: r.description,
      quantity: r.quantity,
      rate: r.rate * scale,
      amount: r.amount * scale,
    }))
  }

  const each = total / normalized.length
  return normalized.map((r) => ({
    description: r.description,
    quantity: r.quantity,
    rate: each / r.quantity,
    amount: each,
  }))
}
