import { errorMessage } from "@/lib/error-message"

/**
 * Server-only HTML → PDF using Puppeteer (same pattern as BOL / DVIR PDF routes).
 */
export async function htmlToPdfBuffer(html: string): Promise<{ pdf: Buffer | null; error: string | null }> {
  try {
    let puppeteer: any
    let executablePath: string | undefined
    let chromiumArgs: string[] | undefined

    try {
      const puppeteerCore = await import(/* webpackIgnore: true */ "puppeteer-core").catch(() => null)
      const chromiumModule = await import(/* webpackIgnore: true */ "@sparticuz/chromium").catch(() => null)

      if (puppeteerCore && chromiumModule) {
        puppeteer = puppeteerCore
        const chromium = chromiumModule.default || chromiumModule
        executablePath = await chromium.executablePath()
        chromiumArgs = chromium.args
      }
    } catch {
      /* optional full puppeteer omitted — use puppeteer-core + @sparticuz/chromium */
    }

    if (!puppeteer) {
      return {
        pdf: null,
        error: "PDF generation requires puppeteer-core / puppeteer. Invoice packet will fail until PDF is available.",
      }
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: chromiumArgs || ["--no-sandbox", "--disable-setuid-sandbox"],
      ...(executablePath && { executablePath }),
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: "networkidle0" })
      const pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
        margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
      })
      return { pdf: Buffer.from(pdfBuffer), error: null }
    } finally {
      await browser.close()
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? errorMessage(e) : "PDF generation failed"
    console.error("[htmlToPdfBuffer]", msg)
    return { pdf: null, error: msg }
  }
}
