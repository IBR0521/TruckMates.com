"use server"

import React from "react"
import * as Sentry from "@sentry/nextjs"
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCurrentCompanyFeatureAccess } from "@/lib/plan-gates"

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#4b5563", marginBottom: 10 },
  section: { marginTop: 8, borderWidth: 1, borderColor: "#e5e7eb", padding: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { width: "40%", color: "#6b7280" },
  value: { width: "60%", textAlign: "right" },
  notice: { marginTop: 10, fontSize: 9, color: "#b91c1c" },
})

async function toPdfBytes(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer())
  if (value && typeof value === "object" && "getReader" in value) {
    const buffer = await new Response(value as ReadableStream).arrayBuffer()
    return new Uint8Array(buffer)
  }
  throw new Error("Unsupported PDF output type")
}

function buildPlacardSuggestion(hazardClass?: string | null): string {
  const value = String(hazardClass || "").trim()
  if (!value) return "HAZMAT"
  if (value.startsWith("2.1")) return "FLAMMABLE GAS"
  if (value.startsWith("2.2")) return "NON-FLAMMABLE GAS"
  if (value.startsWith("2.3")) return "POISON GAS"
  if (value.startsWith("3")) return "FLAMMABLE"
  if (value.startsWith("4")) return "FLAMMABLE SOLID"
  if (value.startsWith("5")) return "OXIDIZER"
  if (value.startsWith("6")) return "POISON"
  if (value.startsWith("7")) return "RADIOACTIVE"
  if (value.startsWith("8")) return "CORROSIVE"
  if (value.startsWith("9")) return "CLASS 9"
  return `CLASS ${value}`
}

export async function generateHazmatShippingPaper(loadId: string): Promise<{
  data: { documentId: string; filePath: string; fileName: string } | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }
    const gate = await getCurrentCompanyFeatureAccess("hazmat")
    if (!gate.allowed) {
      return {
        data: null,
        error: "HAZMAT workflows are available on Fleet and Enterprise plans. Please upgrade to continue.",
        upgrade: {
          required: true,
          feature: "hazmat",
        },
      } as any
    }

    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select(`
        id, company_id, shipment_number, load_date, estimated_delivery,
        origin, destination, is_hazardous, un_number, hazard_class, packing_group,
        proper_shipping_name, placard_required, emergency_contact,
        shipper_name, consignee_name, driver_id
      `)
      .eq("id", loadId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (loadError || !load) return { data: null, error: "Load not found" }
    if (!load.is_hazardous) return { data: null, error: "Shipping paper can be generated only for HAZMAT loads" }
    if (!load.un_number || !load.hazard_class || !load.proper_shipping_name) {
      return { data: null, error: "Missing required HAZMAT fields (UN number, hazard class, proper shipping name)" }
    }

    const { data: company } = await supabase.from("companies").select("name").eq("id", ctx.companyId).maybeSingle()
    const placardText = load.placard_required ? buildPlacardSuggestion(load.hazard_class) : "Not required"
    const issueDate = new Date().toISOString().slice(0, 10)

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "LETTER", style: styles.page },
        React.createElement(Text, { style: styles.title }, "HAZMAT Shipping Paper"),
        React.createElement(
          Text,
          { style: styles.subtitle },
          "49 CFR 172.200 formatted operational copy (verify against final shipper instructions)",
        ),
        React.createElement(
          View,
          { style: styles.section },
          React.createElement(Text, { style: styles.sectionTitle }, "Shipment"),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Carrier"), React.createElement(Text, { style: styles.value }, company?.name || "Carrier")),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Shipment #"), React.createElement(Text, { style: styles.value }, load.shipment_number || load.id)),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Issue Date"), React.createElement(Text, { style: styles.value }, issueDate)),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Shipper"), React.createElement(Text, { style: styles.value }, load.shipper_name || load.origin || "N/A")),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Consignee"), React.createElement(Text, { style: styles.value }, load.consignee_name || load.destination || "N/A")),
        ),
        React.createElement(
          View,
          { style: styles.section },
          React.createElement(Text, { style: styles.sectionTitle }, "Hazardous Material Description"),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "UN Number"), React.createElement(Text, { style: styles.value }, load.un_number)),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Proper Shipping Name"), React.createElement(Text, { style: styles.value }, load.proper_shipping_name)),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Hazard Class"), React.createElement(Text, { style: styles.value }, load.hazard_class)),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Packing Group"), React.createElement(Text, { style: styles.value }, load.packing_group || "N/A")),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Placard"), React.createElement(Text, { style: styles.value }, placardText)),
          React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Emergency Contact"), React.createElement(Text, { style: styles.value }, load.emergency_contact || "N/A")),
        ),
        React.createElement(
          Text,
          { style: styles.notice },
          "Emergency response information must be immediately available during transportation per 49 CFR 172 Subpart G.",
        ),
      ),
    )

    const pdfOutput = await pdf(doc).toBuffer()
    const pdfBytes = await toPdfBytes(pdfOutput)
    const fileName = `hazmat-shipping-paper-${load.shipment_number || load.id}.pdf`
    const filePath = `hazmat-shipping-papers/${ctx.companyId}/${loadId}-${Date.now()}.pdf`

    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    })
    if (uploadError) return { data: null, error: `Failed to store PDF: ${uploadError.message}` }

    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert({
        company_id: ctx.companyId,
        load_id: loadId,
        name: fileName,
        type: "hazmat_shipping_paper",
        file_url: filePath,
        file_size: pdfBytes.byteLength,
        upload_date: issueDate,
      })
      .select("id")
      .single()

    if (insertError || !inserted) return { data: null, error: "Shipping paper saved but document record failed" }

    revalidatePath(`/dashboard/loads/${loadId}`)
    revalidatePath("/dashboard/documents")
    return { data: { documentId: inserted.id, filePath, fileName }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "Failed to generate HAZMAT shipping paper") }
  }
}
