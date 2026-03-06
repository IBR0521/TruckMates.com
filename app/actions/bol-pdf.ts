"use server"

import { createClient } from "@/lib/supabase/server"

// Generate BOL PDF data (returns HTML that can be converted to PDF)
export async function generateBOLPDF(bolId: string): Promise<{
  html: string
  error: string | null
}> {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!bolId || typeof bolId !== "string" || bolId.trim().length === 0) {
      return { html: "", error: "Invalid BOL ID" }
    }

    const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { html: "", error: "Not authenticated" }
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError) {
    return { html: "", error: userError.message || "Failed to fetch user data" }
  }

  if (!userData?.company_id) {
    return { html: "", error: "No company found" }
  }

  // Get BOL data
  // V3-007 FIX: Replace select(*) with explicit columns
  const { data: bol, error } = await supabase
    .from("bols")
    .select("id, company_id, bol_number, created_at, shipper_name, shipper_address, shipper_city, shipper_state, shipper_zip, shipper_phone, shipper_email, consignee_name, consignee_address, consignee_city, consignee_state, consignee_zip, consignee_phone, consignee_email, carrier_name, carrier_mc_number, carrier_dot_number, pickup_date, delivery_date, freight_charges, payment_terms, special_instructions, shipper_signature, driver_signature, consignee_signature, load_id, metadata")
    .eq("id", bolId)
    .eq("company_id", userData.company_id)
    .maybeSingle()

  if (error || !bol) {
    return { html: "", error: "BOL not found" }
  }

  // SECURITY FIX 1: HTML escape function to prevent XSS
  function escapeHtml(text: string | null | undefined): string {
    if (!text) return ''
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (m) => map[m])
  }

  // CRITICAL FIX 4: Convert signature URL to base64 data URI to prevent expiration
  async function convertSignatureToBase64(signatureUrl: string | null | undefined): Promise<string | null> {
    if (!signatureUrl) return null

    try {
      // If already a data URI, return as-is
      if (signatureUrl.startsWith('data:')) {
        return signatureUrl
      }

      // Handle Supabase Storage URLs - try to fetch using Supabase client if it's a storage URL
      let imageData: ArrayBuffer | null = null
      let contentType = 'image/png'

      // Check if it's a Supabase Storage URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (supabaseUrl && signatureUrl.includes(supabaseUrl)) {
        // Extract path from URL
        const urlPath = signatureUrl.split('/storage/v1/object/public/')[1] || 
                       signatureUrl.split('/storage/v1/object/sign/')[1]?.split('?')[0]
        
        if (urlPath) {
          // Try to download using Supabase client
          const { data, error } = await supabase.storage
            .from(urlPath.split('/')[0]) // Get bucket name
            .download(urlPath.split('/').slice(1).join('/')) // Get file path
          
          if (!error && data) {
            imageData = await data.arrayBuffer()
            contentType = data.type || 'image/png'
          }
        }
      }

      // Fallback: fetch directly if not Supabase Storage or if Supabase fetch failed
      if (!imageData) {
        const response = await fetch(signatureUrl)
        if (!response.ok) {
          console.warn(`[BOL PDF] Failed to fetch signature image: ${signatureUrl}`)
          return null
        }
        imageData = await response.arrayBuffer()
        contentType = response.headers.get('content-type') || 'image/png'
      }

      // Convert to buffer and then to base64
      const buffer = Buffer.from(imageData)
      const base64 = buffer.toString('base64')
      
      return `data:${contentType};base64,${base64}`
    } catch (error) {
      console.error(`[BOL PDF] Error converting signature to base64:`, error)
      return null
    }
  }

  // Convert all signature URLs to base64 data URIs
  const shipperSignatureDataUri = bol.shipper_signature?.signature_url 
    ? await convertSignatureToBase64(bol.shipper_signature.signature_url)
    : null
  
  const driverSignatureDataUri = bol.driver_signature?.signature_url
    ? await convertSignatureToBase64(bol.driver_signature.signature_url)
    : null
  
  const consigneeSignatureDataUri = bol.consignee_signature?.signature_url
    ? await convertSignatureToBase64(bol.consignee_signature.signature_url)
    : null

  // Generate HTML for PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>BOL ${escapeHtml(bol.bol_number)}</title>
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
        <p>BOL Number: ${escapeHtml(bol.bol_number)}</p>
        ${bol.created_at ? `<p>Date: ${escapeHtml((() => {
          try {
            const date = new Date(bol.created_at)
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
          } catch {
            return ''
          }
        })())}</p>` : ''}
      </div>

      <div class="section two-column">
        <div class="column">
          <div class="section-title">SHIPPER</div>
          <div class="info-row">
            <div class="info-label">Name:</div>
            <div class="info-value">${escapeHtml(bol.shipper_name) || '—'}</div>
          </div>
          ${bol.shipper_address ? `
          <div class="info-row">
            <div class="info-label">Address:</div>
            <div class="info-value">${escapeHtml(bol.shipper_address)}${bol.shipper_city ? `, ${escapeHtml(bol.shipper_city)}` : ''}${bol.shipper_state ? `, ${escapeHtml(bol.shipper_state)}` : ''} ${escapeHtml(bol.shipper_zip) || ''}</div>
          </div>
          ` : ''}
          ${bol.shipper_phone ? `
          <div class="info-row">
            <div class="info-label">Phone:</div>
            <div class="info-value">${escapeHtml(bol.shipper_phone)}</div>
          </div>
          ` : ''}
          ${bol.shipper_email ? `
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${escapeHtml(bol.shipper_email)}</div>
          </div>
          ` : ''}
        </div>

        <div class="column">
          <div class="section-title">CONSIGNEE</div>
          <div class="info-row">
            <div class="info-label">Name:</div>
            <div class="info-value">${escapeHtml(bol.consignee_name) || '—'}</div>
          </div>
          ${bol.consignee_address ? `
          <div class="info-row">
            <div class="info-label">Address:</div>
            <div class="info-value">${escapeHtml(bol.consignee_address)}${bol.consignee_city ? `, ${escapeHtml(bol.consignee_city)}` : ''}${bol.consignee_state ? `, ${escapeHtml(bol.consignee_state)}` : ''} ${escapeHtml(bol.consignee_zip) || ''}</div>
          </div>
          ` : ''}
          ${bol.consignee_phone ? `
          <div class="info-row">
            <div class="info-label">Phone:</div>
            <div class="info-value">${escapeHtml(bol.consignee_phone)}</div>
          </div>
          ` : ''}
          ${bol.consignee_email ? `
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${escapeHtml(bol.consignee_email)}</div>
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
              <div class="info-value">${escapeHtml(bol.carrier_name)}</div>
            </div>
            ` : ''}
            ${bol.carrier_mc_number ? `
            <div class="info-row">
              <div class="info-label">MC Number:</div>
              <div class="info-value">${escapeHtml(bol.carrier_mc_number)}</div>
            </div>
            ` : ''}
            ${bol.carrier_dot_number ? `
            <div class="info-row">
              <div class="info-label">DOT Number:</div>
              <div class="info-value">${escapeHtml(bol.carrier_dot_number)}</div>
            </div>
            ` : ''}
          </div>
          <div class="column">
            ${bol.pickup_date ? `
            <div class="info-row">
              <div class="info-label">Pickup Date:</div>
              <div class="info-value">${escapeHtml((() => {
                try {
                  const date = new Date(bol.pickup_date)
                  return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
                } catch {
                  return ''
                }
              })())}</div>
            </div>
            ` : ''}
            ${bol.delivery_date ? `
            <div class="info-row">
              <div class="info-label">Delivery Date:</div>
              <div class="info-value">${escapeHtml((() => {
                try {
                  const date = new Date(bol.delivery_date)
                  return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
                } catch {
                  return ''
                }
              })())}</div>
            </div>
            ` : ''}
            ${bol.freight_charges ? `
            <div class="info-row">
              <div class="info-label">Freight Charges:</div>
              <div class="info-value">$${escapeHtml((() => {
                const charges = typeof bol.freight_charges === "number" ? bol.freight_charges : parseFloat(String(bol.freight_charges || 0))
                return isNaN(charges) || !isFinite(charges) ? "0.00" : charges.toFixed(2)
              })())}</div>
            </div>
            ` : ''}
            ${bol.payment_terms ? `
            <div class="info-row">
              <div class="info-label">Payment Terms:</div>
              <div class="info-value">${escapeHtml(bol.payment_terms)}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${bol.special_instructions ? `
      <div class="section">
        <div class="section-title">SPECIAL INSTRUCTIONS</div>
        <div class="info-value">${escapeHtml(bol.special_instructions).replace(/\n/g, '<br>')}</div>
      </div>
      ` : ''}

      <div class="signature-section">
        <div class="signature-box">
          <div class="section-title">SHIPPER SIGNATURE</div>
          ${shipperSignatureDataUri ? `
            <img src="${shipperSignatureDataUri}" class="signature-image" alt="Shipper signature" />
          ` : ''}
          <div class="signature-line">
            <div class="signature-label">
              ${escapeHtml(bol.shipper_signature?.signed_by) || 'Signature'}
            </div>
            ${bol.shipper_signature?.signed_at ? `
            <div class="signature-label" style="font-size: 10px; margin-top: 5px;">
              ${escapeHtml((() => {
                try {
                  const date = new Date(bol.shipper_signature.signed_at)
                  return isNaN(date.getTime()) ? '' : date.toLocaleString()
                } catch {
                  return ''
                }
              })())}
            </div>
            ` : ''}
          </div>
        </div>

        <div class="signature-box">
          <div class="section-title">DRIVER SIGNATURE</div>
          ${driverSignatureDataUri ? `
            <img src="${driverSignatureDataUri}" class="signature-image" alt="Driver signature" />
          ` : ''}
          <div class="signature-line">
            <div class="signature-label">
              ${escapeHtml(bol.driver_signature?.signed_by) || 'Signature'}
            </div>
            ${bol.driver_signature?.signed_at ? `
            <div class="signature-label" style="font-size: 10px; margin-top: 5px;">
              ${escapeHtml((() => {
                try {
                  const date = new Date(bol.driver_signature.signed_at)
                  return isNaN(date.getTime()) ? '' : date.toLocaleString()
                } catch {
                  return ''
                }
              })())}
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${bol.consignee_signature ? `
      <div class="signature-section">
        <div class="signature-box">
          <div class="section-title">CONSIGNEE SIGNATURE</div>
          ${consigneeSignatureDataUri ? `
            <img src="${consigneeSignatureDataUri}" class="signature-image" alt="Consignee signature" />
          ` : ''}
          <div class="signature-line">
            <div class="signature-label">
              ${escapeHtml(bol.consignee_signature.signed_by) || 'Signature'}
            </div>
            ${bol.consignee_signature.signed_at ? `
            <div class="signature-label" style="font-size: 10px; margin-top: 5px;">
              ${escapeHtml((() => {
                try {
                  const date = new Date(bol.consignee_signature.signed_at)
                  return isNaN(date.getTime()) ? '' : date.toLocaleString()
                } catch {
                  return ''
                }
              })())}
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
  } catch (error: any) {
    console.error("[generateBOLPDF] Unexpected error:", error)
    return { html: "", error: error?.message || "Failed to generate BOL PDF" }
  }
}

/**
 * Generate BOL PDF as actual PDF file (using Puppeteer)
 */
export async function generateBOLPDFFile(bolId: string): Promise<{
  pdf: Buffer | null
  error: string | null
}> {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!bolId || typeof bolId !== "string" || bolId.trim().length === 0) {
      return { pdf: null, error: "Invalid BOL ID" }
    }

    // First generate the HTML
    const htmlResult = await generateBOLPDF(bolId)
    
    if (htmlResult.error || !htmlResult.html) {
      return { pdf: null, error: htmlResult.error || "Failed to generate HTML" }
    }

    // Convert HTML to PDF using Puppeteer
    // CRH-002 FIX: Use puppeteer-core + @sparticuz/chromium for serverless (reduces bundle from ~300MB to ~50MB)
    let pdfBuffer: Buffer | null = null
    
    try {
      // Try puppeteer-core first (for serverless/Vercel)
      let puppeteer: any
      let executablePath: string | undefined
      let chromiumArgs: string[] | undefined

      try {
        // @ts-ignore - webpackIgnore: true prevents bundling these optional dependencies
        const puppeteerCore = await import(/* webpackIgnore: true */ "puppeteer-core").catch(() => null)
        // @ts-ignore - @sparticuz/chromium is optional and may not be installed
        const chromiumModule = await import(/* webpackIgnore: true */ "@sparticuz/chromium").catch(() => null)
        
        if (puppeteerCore && chromiumModule) {
          puppeteer = puppeteerCore
          // @sparticuz/chromium may export as default or named export
          const chromium = chromiumModule.default || chromiumModule
          executablePath = await chromium.executablePath()
          chromiumArgs = chromium.args
        }
      } catch {
        // Fallback to regular puppeteer for local development
        // @ts-ignore - webpackIgnore: true prevents bundling this optional dependency
        puppeteer = await import(/* webpackIgnore: true */ "puppeteer").catch(() => null)
      }
      
      if (!puppeteer) {
        return { 
          pdf: null, 
          error: "PDF generation requires Puppeteer. Please install puppeteer-core and @sparticuz/chromium packages" 
        }
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: chromiumArgs || ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(executablePath && { executablePath }),
      })
      
      try {
        const page = await browser.newPage()
        await page.setContent(htmlResult.html, { waitUntil: 'networkidle0' })
        
        // Generate PDF
        pdfBuffer = await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: {
            top: '0.5in',
            right: '0.5in',
            bottom: '0.5in',
            left: '0.5in',
          },
        })
      } finally {
        await browser.close()
      }
    } catch (error: any) {
      console.error("[generateBOLPDFFile] PDF generation error:", error)
      return { 
        pdf: null, 
        error: `Failed to generate PDF: ${error?.message || "Unknown error"}` 
      }
    }

    if (!pdfBuffer) {
      return { pdf: null, error: "Failed to generate PDF buffer" }
    }

    return { pdf: pdfBuffer, error: null }
  } catch (error: any) {
    console.error("[generateBOLPDFFile] Error:", error)
    return { pdf: null, error: error?.message || "Failed to generate BOL PDF" }
  }
}

