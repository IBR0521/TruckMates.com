"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Settlement PDF Generation
 * Generates professional PDF settlement statements for drivers
 */

/**
 * Generate settlement PDF HTML
 */
export async function generateSettlementPDF(settlementId: string): Promise<{
  html: string
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { html: "", error: "Not authenticated" }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { html: "", error: result.error || "No company found" }
  }

  try {
    // Get settlement with related data
    const { data: settlement, error: settlementError } = await supabase
      .from("settlements")
      .select(`
        *,
        driver:driver_id (
          id,
          name,
          email,
          phone
        ),
        pay_rule:pay_rule_id (
          id,
          pay_type,
          base_rate_per_mile,
          base_percentage,
          base_flat_rate
        )
      `)
      .eq("id", settlementId)
      .eq("company_id", result.company_id)
      .single()

    if (settlementError || !settlement) {
      return { html: "", error: "Settlement not found" }
    }

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("name, address, phone, email")
      .eq("id", result.company_id)
      .single()

    // Format dates
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount)
    }

    const driver = settlement.driver as any
    const payRule = settlement.pay_rule as any
    const calculationDetails = (settlement.calculation_details as any) || {}
    const loads = (settlement.loads as any[]) || []

    // Generate HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Settlement Statement - ${driver?.name || "Driver"}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #000;
            padding: 20px;
            background: #fff;
          }
          .header {
            border-bottom: 3px solid #1e3a8a;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
          }
          .company-info {
            flex: 1;
          }
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 10px;
          }
          .settlement-info {
            text-align: right;
          }
          .settlement-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .settlement-number {
            font-size: 14px;
            color: #666;
          }
          .driver-info {
            margin-top: 20px;
            padding: 15px;
            background: #f3f4f6;
            border-radius: 5px;
          }
          .info-row {
            display: flex;
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
          }
          .info-value {
            flex: 1;
          }
          .section {
            margin-top: 30px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #1e3a8a;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 5px;
            margin-bottom: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #1e3a8a;
            color: #fff;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .text-right {
            text-align: right;
          }
          .text-bold {
            font-weight: bold;
          }
          .summary-box {
            margin-top: 20px;
            padding: 20px;
            background: #f3f4f6;
            border-radius: 5px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
          }
          .summary-row:last-child {
            border-bottom: none;
            border-top: 2px solid #1e3a8a;
            margin-top: 10px;
            padding-top: 15px;
            font-size: 16px;
            font-weight: bold;
          }
          .calculation-details {
            margin-top: 15px;
            padding: 15px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .calculation-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 11px;
          }
          .bonus-item, .deduction-item {
            padding-left: 20px;
            color: #059669;
          }
          .deduction-item {
            color: #dc2626;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            font-size: 10px;
            color: #666;
            text-align: center;
          }
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
            padding-top: 60px;
            border-top: 1px solid #000;
            text-align: center;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none; }
            .page-break { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-top">
            <div class="company-info">
              <div class="company-name">${company?.name || "TruckMates"}</div>
              ${company?.address ? `<div>${company.address}</div>` : ""}
              ${company?.phone ? `<div>Phone: ${company.phone}</div>` : ""}
              ${company?.email ? `<div>Email: ${company.email}</div>` : ""}
            </div>
            <div class="settlement-info">
              <div class="settlement-title">SETTLEMENT STATEMENT</div>
              <div class="settlement-number">Settlement #${settlement.id.substring(0, 8).toUpperCase()}</div>
              <div style="margin-top: 10px;">
                <div>Period: ${formatDate(settlement.period_start)} - ${formatDate(settlement.period_end)}</div>
                <div>Generated: ${formatDate(new Date().toISOString())}</div>
              </div>
            </div>
          </div>
          <div class="driver-info">
            <div class="info-row">
              <div class="info-label">Driver Name:</div>
              <div class="info-value">${driver?.name || "N/A"}</div>
            </div>
            ${driver?.email ? `
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value">${driver.email}</div>
            </div>
            ` : ""}
            ${driver?.phone ? `
            <div class="info-row">
              <div class="info-label">Phone:</div>
              <div class="info-value">${driver.phone}</div>
            </div>
            ` : ""}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Pay Calculation Details</div>
          ${payRule ? `
          <div style="margin-bottom: 15px;">
            <strong>Pay Structure:</strong> ${payRule.pay_type?.toUpperCase() || "N/A"}
            ${payRule.base_rate_per_mile ? `<br><strong>Rate per Mile:</strong> ${formatCurrency(payRule.base_rate_per_mile)}` : ""}
            ${payRule.base_percentage ? `<br><strong>Percentage:</strong> ${payRule.base_percentage}%` : ""}
            ${payRule.base_flat_rate ? `<br><strong>Flat Rate per Load:</strong> ${formatCurrency(payRule.base_flat_rate)}` : ""}
          </div>
          ` : ""}
          
          ${calculationDetails.base_pay !== undefined ? `
          <div class="calculation-details">
            <div class="calculation-row">
              <span><strong>Base Pay:</strong></span>
              <span>${formatCurrency(calculationDetails.base_pay || 0)}</span>
            </div>
            ${calculationDetails.miles_used ? `
            <div class="calculation-row" style="padding-left: 20px; color: #666;">
              <span>Miles: ${calculationDetails.miles_used.toLocaleString()}</span>
              <span>× ${formatCurrency(calculationDetails.rate_per_mile || 0)}</span>
            </div>
            ` : ""}
            ${calculationDetails.total_load_value ? `
            <div class="calculation-row" style="padding-left: 20px; color: #666;">
              <span>Total Load Value: ${formatCurrency(calculationDetails.total_load_value)}</span>
              <span>× ${calculationDetails.percentage}%</span>
            </div>
            ` : ""}
            
            ${calculationDetails.bonuses && calculationDetails.bonuses.length > 0 ? `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
              <div class="calculation-row text-bold">Bonuses:</div>
              ${calculationDetails.bonuses.map((bonus: any) => `
              <div class="calculation-row bonus-item">
                <span>${bonus.description || bonus.type}</span>
                <span>${formatCurrency(bonus.amount || 0)}</span>
              </div>
              `).join("")}
              <div class="calculation-row text-bold">
                <span>Total Bonuses:</span>
                <span>${formatCurrency(calculationDetails.bonus_total || 0)}</span>
              </div>
            </div>
            ` : ""}
            
            ${calculationDetails.minimum_guarantee_applied ? `
            <div class="calculation-row" style="margin-top: 10px; color: #059669;">
              <span><strong>Minimum Pay Guarantee Applied:</strong></span>
              <span>${formatCurrency(calculationDetails.minimum_guarantee_amount || 0)}</span>
            </div>
            ` : ""}
          </div>
          ` : ""}
        </div>

        ${loads.length > 0 ? `
        <div class="section">
          <div class="section-title">Loads Included</div>
          <table>
            <thead>
              <tr>
                <th>Load #</th>
                <th>Date</th>
                <th class="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              ${loads.map((load: any) => `
              <tr>
                <td>${load.shipment_number || load.id?.substring(0, 8) || "N/A"}</td>
                <td>${load.date ? formatDate(load.date) : "N/A"}</td>
                <td class="text-right">${formatCurrency(load.value || 0)}</td>
              </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        <div class="section">
          <div class="section-title">Settlement Summary</div>
          <div class="summary-box">
            <div class="summary-row">
              <span>Gross Pay:</span>
              <span class="text-bold">${formatCurrency(Number(settlement.gross_pay) || 0)}</span>
            </div>
            <div class="summary-row">
              <span>Fuel Deduction:</span>
              <span>${formatCurrency(Number(settlement.fuel_deduction) || 0)}</span>
            </div>
            <div class="summary-row">
              <span>Advance Deduction:</span>
              <span>${formatCurrency(Number(settlement.advance_deduction) || 0)}</span>
            </div>
            ${Number(settlement.other_deductions) > 0 ? `
            <div class="summary-row">
              <span>Other Deductions:</span>
              <span>${formatCurrency(Number(settlement.other_deductions) || 0)}</span>
            </div>
            ` : ""}
            <div class="summary-row">
              <span>Total Deductions:</span>
              <span>${formatCurrency(Number(settlement.total_deductions) || 0)}</span>
            </div>
            <div class="summary-row">
              <span>NET PAY:</span>
              <span class="text-bold">${formatCurrency(Number(settlement.net_pay) || 0)}</span>
            </div>
          </div>
        </div>

        ${settlement.notes ? `
        <div class="section">
          <div class="section-title">Notes</div>
          <div style="padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 5px;">
            ${settlement.notes}
          </div>
        </div>
        ` : ""}

        <div class="signature-section">
          <div class="signature-box">
            <div>Driver Signature</div>
            ${settlement.driver_approved ? `
            <div style="margin-top: 10px; font-size: 10px; color: #059669;">
              ✓ Approved on ${settlement.driver_approved_at ? formatDate(settlement.driver_approved_at) : "N/A"}
            </div>
            ` : ""}
          </div>
          <div class="signature-box">
            <div>Company Representative</div>
          </div>
        </div>

        <div class="footer">
          <div>This is a computer-generated settlement statement.</div>
          <div style="margin-top: 5px;">For questions, please contact ${company?.name || "your company"}.</div>
        </div>
      </body>
      </html>
    `

    return { html, error: null }
  } catch (error: any) {
    console.error("[Settlement PDF] Error:", error)
    return { html: "", error: error?.message || "Failed to generate settlement PDF" }
  }
}

/**
 * Save settlement PDF to Supabase Storage
 */
export async function saveSettlementPDF(settlementId: string): Promise<{
  pdfUrl: string | null
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { pdfUrl: null, error: "Not authenticated" }
  }

  try {
    // Generate HTML
    const { html, error: htmlError } = await generateSettlementPDF(settlementId)

    if (htmlError || !html) {
      return { pdfUrl: null, error: htmlError || "Failed to generate PDF HTML" }
    }

    // For now, we'll store the HTML and let the client convert to PDF
    // In production, you could use puppeteer or a PDF service here
    // For now, return the HTML and the client can use browser print or a service

    // Store HTML in Supabase Storage (as a temporary solution)
    // In production, convert HTML to PDF using puppeteer or similar
    const fileName = `settlements/${settlementId}/statement.html`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, html, {
        contentType: "text/html",
        upsert: true,
      })

    if (uploadError) {
      console.error("[Settlement PDF] Upload error:", uploadError)
      // Don't fail - PDF generation is optional
      return { pdfUrl: null, error: null } // Return null but don't error
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName)

    // Update settlement with PDF URL
    await supabase
      .from("settlements")
      .update({ pdf_url: publicUrl })
      .eq("id", settlementId)

    return { pdfUrl: publicUrl, error: null }
  } catch (error: any) {
    console.error("[Settlement PDF] Error:", error)
    return { pdfUrl: null, error: error?.message || "Failed to save settlement PDF" }
  }
}



