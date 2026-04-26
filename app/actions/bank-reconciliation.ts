"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { sanitizeString } from "@/lib/validation"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkCreatePermission, checkEditPermission, checkViewPermission } from "@/lib/server-permissions"

type MatchEntityType = "expense" | "vendor_invoice_payment"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim())
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? ""
    })
    return row
  })
}

function firstNonEmpty(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value && value.trim().length > 0) return value.trim()
  }
  return ""
}

function parseAmount(raw: string): number {
  const cleaned = String(raw || "").replaceAll("$", "").replaceAll(",", "").trim()
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return 0
  return value
}

function parseDate(raw: string): string | null {
  const value = String(raw || "").trim()
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function dateDistanceInDays(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  const ms = Math.abs(da.getTime() - db.getTime())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function calcConfidence(daysDiff: number, amountDiff: number): number {
  let score = 100
  score -= Math.min(daysDiff * 8, 40)
  score -= Math.min(amountDiff * 50, 35)
  return Math.max(0, Math.min(100, score))
}

export async function importBankStatementCsv(input: {
  csvText: string
  fileName?: string
  accountName?: string
  statementMonth?: string
}) {
  const permission = await checkCreatePermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to import statements", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) return { error: ctx.error || "Not authenticated", data: null }

    const rows = parseCsv(input.csvText || "")
    if (rows.length === 0) return { error: "CSV appears empty or invalid", data: null }

    const statementMonth = parseDate(input.statementMonth || "") || new Date().toISOString().slice(0, 10)
    const { data: importRow, error: importError } = await supabase
      .from("bank_statement_imports")
      .insert({
        company_id: ctx.companyId,
        account_name: sanitizeString(input.accountName || "", 120) || null,
        statement_month: statementMonth,
        file_name: sanitizeString(input.fileName || "", 180) || null,
        imported_by: ctx.userId,
      })
      .select("id, statement_month, account_name, imported_at")
      .single()

    if (importError || !importRow) return { error: safeDbError(importError), data: null }

    const txnPayload: Array<Record<string, unknown>> = []
    for (const row of rows) {
      const date = parseDate(firstNonEmpty(row, ["date", "transaction_date", "posted_date"]))
      const description = firstNonEmpty(row, ["description", "memo", "details"])
      const debit = parseAmount(firstNonEmpty(row, ["debit", "withdrawal", "debits"]))
      const credit = parseAmount(firstNonEmpty(row, ["credit", "deposit", "credits"]))
      const directAmount = parseAmount(firstNonEmpty(row, ["amount"]))

      const signed = directAmount !== 0 ? directAmount : credit !== 0 ? credit : -Math.abs(debit)
      const amount = Math.abs(signed)
      const direction = signed >= 0 ? "credit" : "debit"

      if (!date || amount <= 0) continue

      txnPayload.push({
        company_id: ctx.companyId,
        statement_import_id: importRow.id,
        txn_date: date,
        description: sanitizeString(description, 300) || null,
        amount,
        direction,
        status: "unmatched",
        raw_row: row,
      })
    }

    if (txnPayload.length === 0) return { error: "No valid transactions found in CSV", data: null }

    const { error: txnError } = await supabase.from("bank_statement_transactions").insert(txnPayload)
    if (txnError) return { error: safeDbError(txnError), data: null }

    const autoMatch = await autoMatchBankTransactions(importRow.id)
    if (autoMatch.error) return { error: autoMatch.error, data: null }

    revalidatePath("/dashboard/payables/reconcile")
    revalidatePath("/dashboard/payables")

    return { data: { import: importRow, imported_count: txnPayload.length, auto_matched: autoMatch.data?.matched_count || 0 }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to import bank statement"), data: null }
  }
}

export async function autoMatchBankTransactions(statementImportId: string) {
  const permission = await checkEditPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to reconcile", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data: txns, error: txnError } = await supabase
      .from("bank_statement_transactions")
      .select("id, txn_date, amount, direction, status")
      .eq("company_id", ctx.companyId)
      .eq("statement_import_id", statementImportId)
      .eq("status", "unmatched")
      .eq("direction", "debit")
      .limit(10000)

    if (txnError) return { error: safeDbError(txnError), data: null }

    const { data: expenses, error: expenseError } = await supabase
      .from("expenses")
      .select("id, date, amount")
      .eq("company_id", ctx.companyId)
      .order("date", { ascending: false })
      .limit(2000)
    if (expenseError) return { error: safeDbError(expenseError), data: null }

    const { data: paidInvoices, error: invoiceError } = await supabase
      .from("vendor_invoices")
      .select("id, paid_date, amount, status")
      .eq("company_id", ctx.companyId)
      .eq("status", "paid")
      .not("paid_date", "is", null)
      .order("paid_date", { ascending: false })
      .limit(2000)
    if (invoiceError) return { error: safeDbError(invoiceError), data: null }

    let matchedCount = 0
    for (const txn of txns || []) {
      const txnDate = String(txn.txn_date || "")
      const txnAmount = Number(txn.amount || 0)
      if (!txnDate || txnAmount <= 0) continue

      let best: { entityType: MatchEntityType; entityId: string; confidence: number } | null = null

      for (const e of expenses || []) {
        const d = String(e.date || "")
        const amount = Number(e.amount || 0)
        if (!d || amount <= 0) continue
        const amountDiff = Math.abs(amount - txnAmount)
        if (amountDiff > 0.01) continue
        const days = dateDistanceInDays(txnDate, d)
        if (days > 7) continue
        const confidence = calcConfidence(days, amountDiff)
        if (!best || confidence > best.confidence) best = { entityType: "expense", entityId: e.id, confidence }
      }

      for (const inv of paidInvoices || []) {
        const d = String(inv.paid_date || "")
        const amount = Number(inv.amount || 0)
        if (!d || amount <= 0) continue
        const amountDiff = Math.abs(amount - txnAmount)
        if (amountDiff > 0.01) continue
        const days = dateDistanceInDays(txnDate, d)
        if (days > 7) continue
        const confidence = calcConfidence(days, amountDiff)
        if (!best || confidence > best.confidence) best = { entityType: "vendor_invoice_payment", entityId: inv.id, confidence }
      }

      if (!best) continue

      const { error: updateError } = await supabase
        .from("bank_statement_transactions")
        .update({
          status: "matched",
          matched_entity_type: best.entityType,
          matched_entity_id: best.entityId,
          confidence_score: best.confidence,
        })
        .eq("id", txn.id)
        .eq("company_id", ctx.companyId)

      if (!updateError) matchedCount += 1
    }

    revalidatePath("/dashboard/payables/reconcile")
    return { data: { matched_count: matchedCount }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to auto-match bank transactions"), data: null }
  }
}

export async function getBankReconciliationData() {
  const permission = await checkViewPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to view reconciliation", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data: imports, error: importError } = await supabase
      .from("bank_statement_imports")
      .select("id, account_name, statement_month, file_name, imported_at")
      .eq("company_id", ctx.companyId)
      .order("imported_at", { ascending: false })
      .limit(20)
    if (importError) return { error: safeDbError(importError), data: null }

    const latestImportId = imports?.[0]?.id || null
    let txns: Array<Record<string, unknown>> = []
    if (latestImportId) {
      const { data: txnRows, error: txnError } = await supabase
        .from("bank_statement_transactions")
        .select("id, txn_date, description, amount, direction, status, matched_entity_type, matched_entity_id, confidence_score")
        .eq("company_id", ctx.companyId)
        .eq("statement_import_id", latestImportId)
        .order("txn_date", { ascending: false })
        .limit(1000)
      if (txnError) return { error: safeDbError(txnError), data: null }
      txns = txnRows || []
    }

    const matched = txns.filter((t) => String(t.status) === "matched").length
    const unmatched = txns.filter((t) => String(t.status) === "unmatched").length
    const ignored = txns.filter((t) => String(t.status) === "ignored").length

    return {
      data: {
        imports: imports || [],
        latest_import_id: latestImportId,
        transactions: txns,
        summary: {
          total: txns.length,
          matched,
          unmatched,
          ignored,
        },
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load reconciliation data"), data: null }
  }
}

export async function setBankTransactionStatus(input: { transactionId: string; status: "unmatched" | "ignored" }) {
  const permission = await checkEditPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to reconcile", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { error } = await supabase
      .from("bank_statement_transactions")
      .update({
        status: input.status,
        matched_entity_type: null,
        matched_entity_id: null,
        confidence_score: null,
      })
      .eq("id", input.transactionId)
      .eq("company_id", ctx.companyId)
    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/payables/reconcile")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update transaction status"), data: null }
  }
}

export async function manuallyMatchBankTransaction(input: {
  transactionId: string
  entityType: MatchEntityType
  entityId: string
}) {
  const permission = await checkEditPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to reconcile", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { error } = await supabase
      .from("bank_statement_transactions")
      .update({
        status: "matched",
        matched_entity_type: input.entityType,
        matched_entity_id: sanitizeString(input.entityId, 80),
        confidence_score: 100,
      })
      .eq("id", sanitizeString(input.transactionId, 80))
      .eq("company_id", ctx.companyId)
    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/payables/reconcile")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to manually match transaction"), data: null }
  }
}

export async function getManualMatchCandidates(transactionId: string) {
  const permission = await checkViewPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to view reconciliation", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data: txn, error: txnError } = await supabase
      .from("bank_statement_transactions")
      .select("id, txn_date, amount, direction")
      .eq("company_id", ctx.companyId)
      .eq("id", transactionId)
      .single()
    if (txnError || !txn) return { error: safeDbError(txnError, "Transaction not found"), data: null }

    const amount = Number(txn.amount || 0)
    if (amount <= 0 || txn.direction !== "debit") return { data: { expenses: [], invoices: [] }, error: null }

    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("id, date, amount, category, description")
      .eq("company_id", ctx.companyId)
      .gte("amount", amount - 0.01)
      .lte("amount", amount + 0.01)
      .order("date", { ascending: false })
      .limit(50)
    if (expensesError) return { error: safeDbError(expensesError), data: null }

    const { data: invoices, error: invError } = await supabase
      .from("vendor_invoices")
      .select("id, invoice_number, paid_date, amount, vendors:vendor_id(name, company_name)")
      .eq("company_id", ctx.companyId)
      .eq("status", "paid")
      .not("paid_date", "is", null)
      .gte("amount", amount - 0.01)
      .lte("amount", amount + 0.01)
      .order("paid_date", { ascending: false })
      .limit(50)
    if (invError) return { error: safeDbError(invError), data: null }

    return { data: { expenses: expenses || [], invoices: invoices || [] }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load manual match candidates"), data: null }
  }
}
