"use server"

import React from "react"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { errorMessage } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#4b5563" },
  section: { marginTop: 12, borderWidth: 1, borderColor: "#e5e7eb", padding: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#6b7280", width: "42%" },
  value: { width: "58%", textAlign: "right" },
  moneyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  total: { fontWeight: 700, fontSize: 11, marginTop: 6 },
  terms: { marginTop: 14, lineHeight: 1.4 },
  signatures: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
  signatureBox: { width: "48%", borderTopWidth: 1, borderTopColor: "#111827", paddingTop: 6 },
})

function formatCurrency(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value || 0)
  if (!Number.isFinite(n)) return "$0.00"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildRateConfDoc(payload: {
  rateConfNumber: string
  issuedDate: string
  loadNumber: string
  brokerOrShipper: string
  shipperName: string
  shipperAddress: string
  consigneeName: string
  consigneeAddress: string
  pickupDate: string
  deliveryDate: string
  equipment: string
  weight: string
  rate: number
  fuel: number
  accessorial: number
  discount: number
  total: number
  notes: string
  carrierName: string
}) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, "Rate Confirmation"),
        React.createElement(Text, { style: styles.subtitle }, `Rate Conf #: ${payload.rateConfNumber}`),
        React.createElement(Text, { style: styles.subtitle }, `Issued: ${payload.issuedDate}`),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Load Information"),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Load #"), React.createElement(Text, { style: styles.value }, payload.loadNumber)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Broker / Shipper"), React.createElement(Text, { style: styles.value }, payload.brokerOrShipper)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Equipment"), React.createElement(Text, { style: styles.value }, payload.equipment)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Weight"), React.createElement(Text, { style: styles.value }, payload.weight)),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Pickup / Delivery"),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Shipper"), React.createElement(Text, { style: styles.value }, `${payload.shipperName}\n${payload.shipperAddress}`)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Consignee"), React.createElement(Text, { style: styles.value }, `${payload.consigneeName}\n${payload.consigneeAddress}`)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Pickup Date"), React.createElement(Text, { style: styles.value }, payload.pickupDate)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Delivery Date"), React.createElement(Text, { style: styles.value }, payload.deliveryDate)),
      ),

      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Rate Breakdown"),
        React.createElement(View, { style: styles.moneyRow }, React.createElement(Text, null, "Linehaul Rate"), React.createElement(Text, null, formatCurrency(payload.rate))),
        React.createElement(View, { style: styles.moneyRow }, React.createElement(Text, null, "Fuel Surcharge"), React.createElement(Text, null, formatCurrency(payload.fuel))),
        React.createElement(View, { style: styles.moneyRow }, React.createElement(Text, null, "Accessorials"), React.createElement(Text, null, formatCurrency(payload.accessorial))),
        React.createElement(View, { style: styles.moneyRow }, React.createElement(Text, null, "Discount"), React.createElement(Text, null, `-${formatCurrency(payload.discount)}`)),
        React.createElement(View, { style: [styles.moneyRow, styles.total] }, React.createElement(Text, null, "Total Confirmed Rate"), React.createElement(Text, null, formatCurrency(payload.total))),
      ),

      React.createElement(
        View,
        { style: styles.terms },
        React.createElement(
          Text,
          null,
          payload.notes ||
            "Carrier agrees to haul this shipment at the confirmed rate above. Any changes must be mutually agreed in writing before dispatch.",
        ),
      ),

      React.createElement(
        View,
        { style: styles.signatures },
        React.createElement(View, { style: styles.signatureBox }, React.createElement(Text, null, `Broker/Shipper: ${payload.brokerOrShipper}`)),
        React.createElement(View, { style: styles.signatureBox }, React.createElement(Text, null, `Carrier: ${payload.carrierName}`)),
      ),
    ),
  )
}

export async function generateRateConfirmation(loadId: string): Promise<{
  data: { documentId: string; filePath: string; rateConfNumber: string } | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }

    const { data: existing } = await supabase
      .from("documents")
      .select("id, file_url")
      .eq("company_id", ctx.companyId)
      .eq("load_id", loadId)
      .eq("type", "rate_confirmation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      return { data: { documentId: existing.id, filePath: existing.file_url, rateConfNumber: String(existing.id).slice(0, 8) }, error: null }
    }

    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select(`
        id, company_id, shipment_number, origin, destination, load_date, estimated_delivery,
        company_name, shipper_name, shipper_address, shipper_city, shipper_state, shipper_zip,
        consignee_name, consignee_address, consignee_city, consignee_state, consignee_zip,
        carrier_type, load_type, weight, weight_kg,
        rate, fuel_surcharge, accessorial_charges, discount, total_rate, notes, special_instructions
      `)
      .eq("id", loadId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (loadError || !load) return { data: null, error: "Load not found" }

    const { data: company } = await supabase.from("companies").select("name").eq("id", ctx.companyId).maybeSingle()
    const rateConfNumber = `RC-${(load.shipment_number || load.id).toString().replace(/\s+/g, "-")}-${Date.now().toString(36).toUpperCase()}`
    const brokerOrShipper = load.company_name || load.shipper_name || "Shipper"
    const shipperAddress = [load.shipper_address, load.shipper_city, load.shipper_state, load.shipper_zip].filter(Boolean).join(", ")
    const consigneeAddress = [load.consignee_address, load.consignee_city, load.consignee_state, load.consignee_zip].filter(Boolean).join(", ")
    const linehaul = Number(load.rate || 0)
    const fuel = Number(load.fuel_surcharge || 0)
    const accessorial = Number(load.accessorial_charges || 0)
    const discount = Number(load.discount || 0)
    const total = Number(load.total_rate || linehaul + fuel + accessorial - discount)

    const doc = buildRateConfDoc({
      rateConfNumber,
      issuedDate: new Date().toISOString().slice(0, 10),
      loadNumber: load.shipment_number || load.id,
      brokerOrShipper,
      shipperName: load.shipper_name || "Shipper",
      shipperAddress: shipperAddress || load.origin || "",
      consigneeName: load.consignee_name || "Consignee",
      consigneeAddress: consigneeAddress || load.destination || "",
      pickupDate: load.load_date || "",
      deliveryDate: load.estimated_delivery || "",
      equipment: load.carrier_type || load.load_type || "Dry Van",
      weight: load.weight || (load.weight_kg ? `${load.weight_kg} kg` : "N/A"),
      rate: linehaul,
      fuel,
      accessorial,
      discount,
      total,
      notes: load.special_instructions || load.notes || "",
      carrierName: company?.name || "Carrier",
    })

    const pdfBuffer = await pdf(doc).toBuffer()
    const filePath = `rate-confirmations/${ctx.companyId}/${loadId}-${Date.now()}.pdf`
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    })
    if (uploadError) return { data: null, error: `Failed to store PDF: ${uploadError.message}` }

    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert({
        company_id: ctx.companyId,
        load_id: loadId,
        name: `${rateConfNumber}.pdf`,
        type: "rate_confirmation",
        file_url: filePath,
        file_size: pdfBuffer.length,
        upload_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single()

    if (insertError || !inserted) return { data: null, error: "Rate confirmation saved but document record failed" }

    revalidatePath(`/dashboard/loads/${loadId}`)
    revalidatePath("/dashboard/documents")
    return { data: { documentId: inserted.id, filePath, rateConfNumber }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "Failed to generate rate confirmation") }
  }
}
