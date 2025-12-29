"use server"

import { createClient } from "@/lib/supabase/server"

// Generate BOL PDF data (returns HTML that can be converted to PDF)
export async function generateBOLPDF(bolId: string): Promise<{
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

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { html: "", error: "No company found" }
  }

  // Get BOL data
  const { data: bol, error } = await supabase
    .from("bols")
    .select("*")
    .eq("id", bolId)
    .eq("company_id", userData.company_id)
    .single()

  if (error || !bol) {
    return { html: "", error: "BOL not found" }
  }

  // Generate HTML for PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>BOL ${bol.bol_number}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #000;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #000;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .header p {
          margin: 5px 0;
          font-size: 14px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          border-bottom: 2px solid #000;
          padding-bottom: 5px;
          margin-bottom: 15px;
        }
        .two-column {
          display: flex;
          justify-content: space-between;
        }
        .column {
          width: 48%;
        }
        .info-row {
          margin-bottom: 10px;
        }
        .info-label {
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 3px;
        }
        .info-value {
          font-size: 14px;
        }
        .signature-section {
          margin-top: 40px;
          border-top: 2px solid #000;
          padding-top: 20px;
        }
        .signature-box {
          width: 48%;
          display: inline-block;
          vertical-align: top;
          margin-right: 4%;
        }
        .signature-box:last-child {
          margin-right: 0;
        }
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 60px;
          padding-top: 5px;
        }
        .signature-label {
          font-size: 12px;
          text-align: center;
        }
        .signature-image {
          max-width: 200px;
          max-height: 80px;
          margin-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .footer {
          margin-top: 40px;
          font-size: 11px;
          color: #666;
          text-align: center;
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BILL OF LADING</h1>
        <p>BOL Number: ${bol.bol_number}</p>
        ${bol.created_at ? `<p>Date: ${new Date(bol.created_at).toLocaleDateString()}</p>` : ''}
      </div>

      <div class="section two-column">
        <div class="column">
          <div class="section-title">SHIPPER</div>
          <div class="info-row">
            <div class="info-label">Name:</div>
            <div class="info-value">${bol.shipper_name || '—'}</div>
          </div>
          ${bol.shipper_address ? `
          <div class="info-row">
            <div class="info-label">Address:</div>
            <div class="info-value">${bol.shipper_address}${bol.shipper_city ? `, ${bol.shipper_city}` : ''}${bol.shipper_state ? `, ${bol.shipper_state}` : ''} ${bol.shipper_zip || ''}</div>
          </div>
          ` : ''}
          ${bol.shipper_phone ? `
          <div class="info-row">
            <div class="info-label">Phone:</div>
            <div class="info-value">${bol.shipper_phone}</div>
          </div>
          ` : ''}
          ${bol.shipper_email ? `
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${bol.shipper_email}</div>
          </div>
          ` : ''}
        </div>

        <div class="column">
          <div class="section-title">CONSIGNEE</div>
          <div class="info-row">
            <div class="info-label">Name:</div>
            <div class="info-value">${bol.consignee_name || '—'}</div>
          </div>
          ${bol.consignee_address ? `
          <div class="info-row">
            <div class="info-label">Address:</div>
            <div class="info-value">${bol.consignee_address}${bol.consignee_city ? `, ${bol.consignee_city}` : ''}${bol.consignee_state ? `, ${bol.consignee_state}` : ''} ${bol.consignee_zip || ''}</div>
          </div>
          ` : ''}
          ${bol.consignee_phone ? `
          <div class="info-row">
            <div class="info-label">Phone:</div>
            <div class="info-value">${bol.consignee_phone}</div>
          </div>
          ` : ''}
          ${bol.consignee_email ? `
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${bol.consignee_email}</div>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">CARRIER INFORMATION</div>
        <div class="two-column">
          <div class="column">
            ${bol.carrier_name ? `
            <div class="info-row">
              <div class="info-label">Carrier Name:</div>
              <div class="info-value">${bol.carrier_name}</div>
            </div>
            ` : ''}
            ${bol.carrier_mc_number ? `
            <div class="info-row">
              <div class="info-label">MC Number:</div>
              <div class="info-value">${bol.carrier_mc_number}</div>
            </div>
            ` : ''}
            ${bol.carrier_dot_number ? `
            <div class="info-row">
              <div class="info-label">DOT Number:</div>
              <div class="info-value">${bol.carrier_dot_number}</div>
            </div>
            ` : ''}
          </div>
          <div class="column">
            ${bol.pickup_date ? `
            <div class="info-row">
              <div class="info-label">Pickup Date:</div>
              <div class="info-value">${new Date(bol.pickup_date).toLocaleDateString()}</div>
            </div>
            ` : ''}
            ${bol.delivery_date ? `
            <div class="info-row">
              <div class="info-label">Delivery Date:</div>
              <div class="info-value">${new Date(bol.delivery_date).toLocaleDateString()}</div>
            </div>
            ` : ''}
            ${bol.freight_charges ? `
            <div class="info-row">
              <div class="info-label">Freight Charges:</div>
              <div class="info-value">$${bol.freight_charges.toFixed(2)}</div>
            </div>
            ` : ''}
            ${bol.payment_terms ? `
            <div class="info-row">
              <div class="info-label">Payment Terms:</div>
              <div class="info-value">${bol.payment_terms}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${bol.special_instructions ? `
      <div class="section">
        <div class="section-title">SPECIAL INSTRUCTIONS</div>
        <div class="info-value">${bol.special_instructions.replace(/\n/g, '<br>')}</div>
      </div>
      ` : ''}

      <div class="signature-section">
        <div class="signature-box">
          <div class="section-title">SHIPPER SIGNATURE</div>
          ${bol.shipper_signature?.signature_url ? `
            <img src="${bol.shipper_signature.signature_url}" class="signature-image" alt="Shipper signature" />
          ` : ''}
          <div class="signature-line">
            <div class="signature-label">
              ${bol.shipper_signature?.signed_by || 'Signature'}
            </div>
            ${bol.shipper_signature?.signed_at ? `
            <div class="signature-label" style="font-size: 10px; margin-top: 5px;">
              ${new Date(bol.shipper_signature.signed_at).toLocaleString()}
            </div>
            ` : ''}
          </div>
        </div>

        <div class="signature-box">
          <div class="section-title">DRIVER SIGNATURE</div>
          ${bol.driver_signature?.signature_url ? `
            <img src="${bol.driver_signature.signature_url}" class="signature-image" alt="Driver signature" />
          ` : ''}
          <div class="signature-line">
            <div class="signature-label">
              ${bol.driver_signature?.signed_by || 'Signature'}
            </div>
            ${bol.driver_signature?.signed_at ? `
            <div class="signature-label" style="font-size: 10px; margin-top: 5px;">
              ${new Date(bol.driver_signature.signed_at).toLocaleString()}
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${bol.consignee_signature ? `
      <div class="signature-section">
        <div class="signature-box">
          <div class="section-title">CONSIGNEE SIGNATURE</div>
          ${bol.consignee_signature.signature_url ? `
            <img src="${bol.consignee_signature.signature_url}" class="signature-image" alt="Consignee signature" />
          ` : ''}
          <div class="signature-line">
            <div class="signature-label">
              ${bol.consignee_signature.signed_by || 'Signature'}
            </div>
            ${bol.consignee_signature.signed_at ? `
            <div class="signature-label" style="font-size: 10px; margin-top: 5px;">
              ${new Date(bol.consignee_signature.signed_at).toLocaleString()}
            </div>
            ` : ''}
          </div>
        </div>
      </div>
      ` : ''}

      <div class="footer">
        <p>This is a computer-generated document. For questions, please contact the carrier.</p>
      </div>
    </body>
    </html>
  `

  return { html, error: null }
}

