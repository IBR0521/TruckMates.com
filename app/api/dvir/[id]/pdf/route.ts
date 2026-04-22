import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { generateSingleDVIRPDF } from "@/app/actions/dvir-pdf"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params

  try {
    const htmlResult = await generateSingleDVIRPDF(id)
    if (htmlResult.error || !htmlResult.html) {
      return NextResponse.json(
        { error: htmlResult.error || "Failed to generate DVIR PDF HTML" },
        { status: 400 }
      )
    }

    try {
      let puppeteer: any
      let executablePath: string | undefined
      let chromiumArgs: string[] | undefined

      try {
        const puppeteerCore = await import(/* webpackIgnore: true */ "puppeteer-core").catch(() => null)
        const chromiumModule = await import(/* webpackIgnore: true */ "@sparticuz/chromium").catch(() => null)
        const chromium = chromiumModule?.default || chromiumModule
        if (puppeteerCore && chromium) {
          puppeteer = puppeteerCore
          executablePath = await (chromium as any).executablePath()
          chromiumArgs = (chromium as any).args
        }
      } catch {
        puppeteer = await import(/* webpackIgnore: true */ "puppeteer").catch(() => null)
      }

      if (!puppeteer) {
        return new NextResponse(htmlResult.html, {
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition": `inline; filename="dvir-${String(id).slice(0, 8)}.html"`,
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
        await page.setContent(htmlResult.html, { waitUntil: "load" })
        const pdfBuffer = await page.pdf({
          format: "Letter",
          printBackground: true,
          margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
        })

        return new NextResponse(pdfBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="dvir-${String(id).slice(0, 8)}.pdf"`,
            "Cache-Control": "no-cache",
          },
        })
      } finally {
        await browser.close()
      }
    } catch {
      return new NextResponse(htmlResult.html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `inline; filename="dvir-${String(id).slice(0, 8)}.html"`,
          "X-DVIR-PDF-Fallback": "puppeteer-error",
        },
      })
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, "Failed to generate DVIR PDF") },
      { status: 500 }
    )
  }
}
