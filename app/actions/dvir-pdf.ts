"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { getDVIRsForAudit } from "./dvir-enhanced"

/**
 * Generate DVIR Audit PDF HTML
 * Returns HTML that can be converted to PDF for audit purposes
 */
export async function generateDVIRAuditPDF(filters?: {
  truck_id?: string
  start_date?: string
  end_date?: string
}): Promise<{
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
    // Get DVIRs for audit
    const dvirResult = await getDVIRsForAudit(filters)
    if (dvirResult.error || !dvirResult.data) {
      return { html: "", error: dvirResult.error || "Failed to fetch DVIRs" }
    }

    const dvirs = dvirResult.data

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("name, address, phone, email")
      .eq("id", result.company_id)
      .single()

    // Format date
    const formatDate = (date: string | Date) => {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }

    // Format time
    const formatTime = (time: string | null) => {
      if (!time) return "N/A"
      return time
    }

    // Generate HTML for PDF
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>DVIR Audit Report</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #000;
          font-size: 11px;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #000;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: bold;
        }
        .header p {
          margin: 5px 0;
          font-size: 12px;
        }
        .report-info {
          margin-bottom: 20px;
          padding: 10px;
          background-color: #f5f5f5;
          border: 1px solid #ddd;
        }
        .report-info p {
          margin: 3px 0;
          font-size: 11px;
        }
        .dvir-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
          border: 1px solid #000;
          padding: 15px;
        }
        .dvir-header {
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .dvir-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: bold;
        }
        .dvir-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 15px;
        }
        .info-item {
          margin-bottom: 8px;
        }
        .info-label {
          font-weight: bold;
          font-size: 10px;
          margin-bottom: 2px;
        }
        .info-value {
          font-size: 11px;
        }
        .status-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
        }
        .status-passed {
          background-color: #d4edda;
          color: #155724;
        }
        .status-failed {
          background-color: #f8d7da;
          color: #721c24;
        }
        .status-defects-corrected {
          background-color: #fff3cd;
          color: #856404;
        }
        .defects-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          margin-bottom: 15px;
        }
        .defects-table th,
        .defects-table td {
          border: 1px solid #000;
          padding: 6px;
          text-align: left;
          font-size: 10px;
        }
        .defects-table th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .severity-critical {
          color: #dc3545;
          font-weight: bold;
        }
        .severity-major {
          color: #ffc107;
          font-weight: bold;
        }
        .severity-minor {
          color: #28a745;
        }
        .signature-section {
          margin-top: 20px;
          border-top: 1px solid #000;
          padding-top: 10px;
        }
        .signature-box {
          display: inline-block;
          width: 45%;
          margin-right: 5%;
          vertical-align: top;
        }
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 50px;
          padding-top: 5px;
        }
        .signature-label {
          font-size: 10px;
          text-align: center;
        }
        .footer {
          margin-top: 40px;
          font-size: 9px;
          color: #666;
          text-align: center;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        @media print {
          body { margin: 0; }
          .dvir-section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>DRIVER VEHICLE INSPECTION REPORT (DVIR)</h1>
        <p>Audit Report</p>
        <p>${company?.name || "Company Name"}</p>
        <p>Generated: ${formatDate(new Date())}</p>
      </div>

      <div class="report-info">
        <p><strong>Report Period:</strong> ${filters?.start_date ? formatDate(filters.start_date) : "All Time"} - ${filters?.end_date ? formatDate(filters.end_date) : "Present"}</p>
        <p><strong>Total Inspections:</strong> ${dvirs.length}</p>
        <p><strong>Filter:</strong> ${filters?.truck_id ? "Specific Truck" : "All Trucks"}</p>
      </div>

      ${dvirs.length === 0 ? `
        <div style="text-align: center; padding: 40px;">
          <p>No DVIRs found for the selected criteria.</p>
        </div>
      ` : dvirs.map((dvir: any) => `
        <div class="dvir-section">
          <div class="dvir-header">
            <h2>DVIR #${dvir.id.substring(0, 8).toUpperCase()}</h2>
          </div>
          
          <div class="dvir-info">
            <div class="info-item">
              <div class="info-label">Inspection Type</div>
              <div class="info-value">${dvir.inspection_type === 'pre_trip' ? 'Pre-Trip' : dvir.inspection_type === 'post_trip' ? 'Post-Trip' : 'On-Road'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Inspection Date</div>
              <div class="info-value">${formatDate(dvir.inspection_date)} ${formatTime(dvir.inspection_time)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Driver</div>
              <div class="info-value">${dvir.driver_name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Truck</div>
              <div class="info-value">${dvir.truck_number || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Location</div>
              <div class="info-value">${dvir.location || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Mileage</div>
              <div class="info-value">${dvir.mileage ? dvir.mileage.toLocaleString() + ' mi' : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">
                <span class="status-badge status-${dvir.status === 'passed' ? 'passed' : dvir.status === 'failed' ? 'failed' : 'defects-corrected'}">
                  ${dvir.status === 'passed' ? 'PASSED' : dvir.status === 'failed' ? 'FAILED' : 'DEFECTS CORRECTED'}
                </span>
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">Safe to Operate</div>
              <div class="info-value">${dvir.safe_to_operate ? 'Yes' : 'No'}</div>
            </div>
          </div>

          ${dvir.defects_found && dvir.defects && (dvir.defects as any[]).length > 0 ? `
            <div>
              <h3 style="font-size: 12px; margin-bottom: 8px;">Defects Found:</h3>
              <table class="defects-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Description</th>
                    <th>Severity</th>
                    <th>Corrected</th>
                  </tr>
                </thead>
                <tbody>
                  ${(dvir.defects as any[]).map((defect: any) => `
                    <tr>
                      <td>${defect.component || 'N/A'}</td>
                      <td>${defect.description || 'N/A'}</td>
                      <td class="severity-${defect.severity || 'minor'}">
                        ${(defect.severity || 'minor').toUpperCase()}
                      </td>
                      <td>${defect.corrected ? 'Yes' : 'No'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="padding: 10px; background-color: #d4edda; border: 1px solid #c3e6cb; margin-top: 10px;">
              <strong>No Defects Found</strong> - Vehicle passed inspection with no issues.
            </div>
          `}

          ${dvir.notes ? `
            <div style="margin-top: 15px;">
              <div class="info-label">Notes:</div>
              <div class="info-value" style="margin-top: 5px;">${dvir.notes}</div>
            </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Driver Signature</div>
              ${dvir.driver_signature_date ? `
                <div class="signature-line">
                  <div class="signature-label">Signed: ${formatDate(dvir.driver_signature_date)}</div>
                </div>
              ` : `
                <div class="signature-line">
                  <div class="signature-label">Not Signed</div>
                </div>
              `}
            </div>
            ${dvir.certified ? `
              <div class="signature-box">
                <div class="signature-label">Certified By</div>
                <div class="signature-line">
                  <div class="signature-label">${dvir.certified_by_name || 'N/A'}</div>
                  <div class="signature-label">Date: ${dvir.certified_date ? formatDate(dvir.certified_date) : 'N/A'}</div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}

      <div class="footer">
        <p>This report was generated by TruckMates on ${formatDate(new Date())}</p>
        <p>For audit and compliance purposes only.</p>
      </div>
    </body>
    </html>
    `

    return { html, error: null }
  } catch (error: any) {
    console.error("[Generate DVIR Audit PDF] Error:", error)
    return { html: "", error: error.message || "Failed to generate DVIR audit PDF" }
  }
}


