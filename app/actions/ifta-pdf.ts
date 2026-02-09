"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * IFTA Report PDF Generation
 * Generates audit-ready PDF reports for IFTA filing
 */

/**
 * Generate IFTA report PDF HTML
 */
export async function generateIFTAReportPDF(reportId: string): Promise<{
  html: string
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { html: "", error: "Not authenticated" }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { html: "", error: result.error || "No company found" }
  }

  try {
    // Get IFTA report with company info
    const { data: report, error: reportError } = await supabase
      .from("ifta_reports")
      .select("*")
      .eq("id", reportId)
      .eq("company_id", result.company_id)
      .single()

    if (reportError || !report) {
      return { html: "", error: "IFTA report not found" }
    }

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("name, address, city, state, zip, phone, email, mc_number, dot_number")
      .eq("id", result.company_id)
      .single()

    // Get state breakdown
    const stateBreakdown = (report.state_breakdown as any[]) || []

    // Format currency
    const formatCurrency = (amount: number | string): string => {
      const num = typeof amount === "string" ? parseFloat(amount.replace(/[^0-9.-]/g, "")) : amount
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(num)
    }

    // Format date
    const formatDate = (dateString: string | null): string => {
      if (!dateString) return "N/A"
      try {
        return new Date(dateString).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      } catch {
        return dateString
      }
    }

    // Generate HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>IFTA Report - ${report.period || `${report.quarter} ${report.year}`}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 11px;
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
            font-size: 22px;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 10px;
          }
          .company-details {
            font-size: 11px;
            line-height: 1.6;
            color: #333;
          }
          .report-info {
            text-align: right;
          }
          .report-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1e3a8a;
          }
          .report-period {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
          }
          .report-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 5px;
          }
          .status-draft {
            background-color: #fef3c7;
            color: #92400e;
          }
          .status-submitted {
            background-color: #dbeafe;
            color: #1e40af;
          }
          .status-approved {
            background-color: #d1fae5;
            color: #065f46;
          }
          .summary-section {
            margin-top: 30px;
            padding: 20px;
            background: #f3f4f6;
            border-radius: 5px;
            border: 2px solid #1e3a8a;
          }
          .summary-title {
            font-size: 16px;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 15px;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 5px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 15px;
          }
          .summary-item {
            display: flex;
            flex-direction: column;
          }
          .summary-label {
            font-size: 10px;
            color: #666;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .summary-value {
            font-size: 18px;
            font-weight: bold;
            color: #000;
          }
          .state-breakdown-section {
            margin-top: 40px;
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
            font-size: 10px;
          }
          th, td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #1e3a8a;
            color: #fff;
            font-weight: bold;
            text-align: center;
          }
          td {
            text-align: right;
          }
          td:first-child {
            text-align: left;
            font-weight: 500;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .total-row {
            background-color: #1e3a8a !important;
            color: #fff;
            font-weight: bold;
          }
          .total-row td {
            border-color: #000;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            font-size: 9px;
            color: #666;
            text-align: center;
          }
          .footer-note {
            margin-top: 15px;
            padding: 15px;
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 5px;
            font-size: 10px;
            color: #856404;
          }
          .certification-section {
            margin-top: 40px;
            padding: 20px;
            border: 2px solid #000;
            background: #fff;
          }
          .certification-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 15px;
            text-align: center;
          }
          .certification-text {
            font-size: 11px;
            line-height: 1.8;
            margin-bottom: 30px;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 50px;
            padding-top: 5px;
            text-align: center;
          }
          .signature-label {
            font-size: 10px;
            margin-top: 5px;
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
              <div class="company-details">
                ${company?.address ? `${company.address}<br>` : ""}
                ${company?.city && company?.state ? `${company.city}, ${company.state} ${company.zip || ""}<br>` : ""}
                ${company?.phone ? `Phone: ${company.phone}<br>` : ""}
                ${company?.email ? `Email: ${company.email}<br>` : ""}
                ${company?.mc_number ? `MC#: ${company.mc_number}<br>` : ""}
                ${company?.dot_number ? `DOT#: ${company.dot_number}` : ""}
              </div>
            </div>
            <div class="report-info">
              <div class="report-title">IFTA Quarterly Report</div>
              <div class="report-period">${report.period || `Quarter ${report.quarter}, ${report.year}`}</div>
              <div class="report-period">Report ID: ${report.id.substring(0, 8).toUpperCase()}</div>
              <div class="report-period">Generated: ${formatDate(new Date().toISOString())}</div>
              <span class="report-status status-${report.status || "draft"}">
                ${(report.status || "draft").toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div class="summary-section">
          <div class="summary-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Miles</div>
              <div class="summary-value">${report.total_miles || "0"}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Fuel Purchased</div>
              <div class="summary-value">${report.fuel_purchased || "0 gal"}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Tax Owed</div>
              <div class="summary-value">${formatCurrency(report.tax_owed || 0)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Report Status</div>
              <div class="summary-value" style="font-size: 14px;">
                ${(report.status || "draft").toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div class="state-breakdown-section">
          <div class="section-title">State-by-State Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>State</th>
                <th>Miles</th>
                <th>Fuel (Gallons)</th>
                <th>Tax Owed</th>
              </tr>
            </thead>
            <tbody>
              ${stateBreakdown
                .map(
                  (state: any) => `
                <tr>
                  <td>${state.state || "N/A"}</td>
                  <td>${state.miles?.toLocaleString() || "0"}</td>
                  <td>${state.fuel || "0 gal"}</td>
                  <td>${state.tax || "$0.00"}</td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td><strong>${report.total_miles || "0"}</strong></td>
                <td><strong>${report.fuel_purchased || "0 gal"}</strong></td>
                <td><strong>${formatCurrency(report.tax_owed || 0)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        ${report.truck_ids && Array.isArray(report.truck_ids) && report.truck_ids.length > 0 ? `
        <div class="state-breakdown-section" style="margin-top: 30px;">
          <div class="section-title">Trucks Included in Report</div>
          <div style="font-size: 11px; line-height: 1.8;">
            ${report.truck_ids.map((id: string) => `Truck ID: ${id.substring(0, 8)}`).join(", ")}
          </div>
        </div>
        ` : ""}

        <div class="certification-section">
          <div class="certification-title">CERTIFICATION</div>
          <div class="certification-text">
            I certify that the information contained in this IFTA quarterly tax return is true, 
            correct, and complete to the best of my knowledge and belief. I understand that 
            making a false statement on this return may result in penalties.
          </div>
          <div class="signature-line">
            <div class="signature-label">Authorized Signature</div>
          </div>
          <div class="signature-line" style="margin-top: 30px;">
            <div class="signature-label">Date</div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-note">
            <strong>Note:</strong> This report is generated from GPS-based mileage data and fuel purchase records. 
            All supporting documentation (mileage logs, fuel receipts) is stored digitally and available for audit review.
            ${report.include_eld ? "This report includes ELD data." : ""}
          </div>
          <div style="margin-top: 20px;">
            Generated by TruckMates IFTA Reporting System<br>
            ${formatDate(new Date().toISOString())}
          </div>
        </div>
      </body>
      </html>
    `

    return { html, error: null }
  } catch (error: any) {
    console.error("Error generating IFTA report PDF:", error)
    return { html: "", error: error.message || "Failed to generate PDF" }
  }
}



