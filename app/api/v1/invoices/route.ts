import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"

const createInvoiceSchema = z.object({
  invoice_number: z.string().min(1),
  customer_name: z.string().min(1),
  load_id: z.string().uuid().optional(),
  amount: z.number().nonnegative(),
  status: z.string().optional(),
  issue_date: z.string(),
  due_date: z.string(),
  payment_terms: z.string().optional(),
  description: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, amount, status, issue_date, due_date, load_id, created_at, updated_at")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false })
    .limit(200)

  const status = error ? 500 : 200
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: "/api/v1/invoices",
    method: "GET",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch invoices" }, { status })
  return NextResponse.json({ data: data || [] }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      company_id: auth.companyId,
      ...parsed.data,
    })
    .select("id, invoice_number, customer_name, amount, status, issue_date, due_date, load_id, created_at")
    .single()

  const status = error ? 500 : 201
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: "/api/v1/invoices",
    method: "POST",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to create invoice" }, { status })
  return NextResponse.json({ data }, { status: 201 })
}
