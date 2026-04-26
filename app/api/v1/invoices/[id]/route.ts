import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"

const patchInvoiceSchema = z
  .object({
    invoice_number: z.string().min(1).optional(),
    customer_name: z.string().min(1).optional(),
    load_id: z.string().uuid().nullable().optional(),
    amount: z.number().nonnegative().optional(),
    status: z.string().optional(),
    issue_date: z.string().optional(),
    due_date: z.string().optional(),
    payment_terms: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update")

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, amount, status, issue_date, due_date, load_id, payment_terms, description, created_at, updated_at")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/invoices/${id}`,
    method: "GET",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch invoice" }, { status })
  if (!data) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = patchInvoiceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("invoices")
    .update(parsed.data)
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id, invoice_number, customer_name, amount, status, issue_date, due_date, load_id, payment_terms, description, updated_at")
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/invoices/${id}`,
    method: "PATCH",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to update invoice" }, { status })
  if (!data) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}
