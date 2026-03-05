import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateDVIRAuditPDF } from "@/app/actions/dvir-pdf"

/**
 * Generate DVIR Audit report as a real PDF file.
 * Uses Puppeteer server-side so the client never imports it.
 * SEC-001 FIX: Added authentication check
 */
export async function GET(req: NextRequest) {
  // SEC-001: Add authentication check
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in to access this resource." },
      { status: 401 }
    )
  }

  const url = new URL(req.url)
  const searchParams = url.searchParams

  const truck_id = searchParams.get("truck_id") || undefined
  const start_date = searchParams.get("start_date") || undefined
  const end_date = searchParams.get("end_date") || undefined

  try {
    // First, generate the HTML using the existing server action
    const htmlResult = await generateDVIRAuditPDF({
      truck_id,
      start_date,
      end_date,
    })

    if (htmlResult.error || !htmlResult.html) {
      return NextResponse.json(
        { error: htmlResult.error || "Failed to generate DVIR audit HTML" },
        { status: 400 }
      )
    }

    // Convert HTML to PDF using Puppeteer
    // CRH-002 FIX: Use puppeteer-core + @sparticuz/chromium for serverless (reduces bundle from ~300MB to ~50MB)
    try {
      let puppeteer: any
      let executablePath: string | undefined
      let chromiumArgs: string[] | undefined

      // Try puppeteer-core first (for serverless/Vercel)
      try {
        const puppeteerCore = await import("puppeteer-core").catch(() => null)
        // @ts-ignore - @sparticuz/chromium may not be installed in all environments
        const chromium = await import("@sparticuz/chromium").catch(() => null)
        
        if (puppeteerCore && chromium) {
          puppeteer = puppeteerCore
          executablePath = await chromium.executablePath()
          chromiumArgs = chromium.args
        }
      } catch {
        // Fallback to regular puppeteer for local development
        puppeteer = await import("puppeteer").catch(() => null)
      }

      if (!puppeteer) {
        // Fallback: return HTML if Puppeteer is not available
        return new NextResponse(htmlResult.html, {
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition": `inline; filename="dvir-audit-report.html"`,
          },
        })
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: chromiumArgs || ["--no-sandbox", "--disable-setuid-sandbox"],
        ...(executablePath && { executablePath }),
      })

      try {
        const page = await browser.newPage()
        await page.setContent(htmlResult.html, { waitUntil: "networkidle0" })

        const pdfBuffer = await page.pdf({
          format: "Letter",
          printBackground: true,
          margin: {
            top: "0.5in",
            right: "0.5in",
            bottom: "0.5in",
            left: "0.5in",
          },
        })

        const fileName = `dvir-audit-${start_date || "all"}-${end_date || "present"}.pdf`

        return new NextResponse(pdfBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-cache",
          },
        })
      } finally {
        await browser.close()
      }
    } catch (error: any) {
      console.error("[DVIR Audit PDF] Puppeteer error:", error)
      return NextResponse.json(
        { error: error?.message || "Failed to generate DVIR audit PDF" },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[DVIR Audit PDF] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to generate DVIR audit PDF" },
      { status: 500 }
    )
  }
}


