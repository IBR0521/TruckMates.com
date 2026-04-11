import fs from "fs"
import { platform } from "os"
import { errorMessage } from "@/lib/error-message"

/** Prefer env, then typical Chrome/Chromium installs (local dev on macOS/Linux/Windows). */
function resolveSystemChromeExecutable(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv
  }
  const p = platform()
  if (p === "darwin") {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if (fs.existsSync(mac)) return mac
  }
  if (p === "linux") {
    for (const cand of [
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ]) {
      if (fs.existsSync(cand)) return cand
    }
  }
  if (p === "win32") {
    const win = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    if (fs.existsSync(win)) return win
  }
  return undefined
}

/**
 * Server-only HTML → PDF using Puppeteer.
 * Order: (1) puppeteer-core + @sparticuz/chromium (Vercel/serverless),
 * (2) optional full `puppeteer` if installed,
 * (3) puppeteer-core + system Chrome from env or common paths (local dev).
 */
export async function htmlToPdfBuffer(html: string): Promise<{ pdf: Buffer | null; error: string | null }> {
  try {
    type PuppeteerModule = { launch: (opts: Record<string, unknown>) => Promise<{ newPage: () => Promise<any>; close: () => Promise<void> }> }
    let puppeteer: PuppeteerModule | null = null
    let executablePath: string | undefined
    let chromiumArgs: string[] | undefined

    // 1) Serverless: puppeteer-core + @sparticuz/chromium (Linux x64 bundle only).
    // On macOS/Windows the bundled binary is the wrong format → spawn ENOEXEC; skip.
    if (platform() === "linux") {
      try {
        const puppeteerCoreMod = await import(/* webpackIgnore: true */ "puppeteer-core").catch(() => null)
        const chromiumMod = await import(/* webpackIgnore: true */ "@sparticuz/chromium").catch(() => null)
        if (puppeteerCoreMod && chromiumMod) {
          const chromium = (chromiumMod as { default?: unknown }).default ?? chromiumMod
          const puppeteerCore = (puppeteerCoreMod as { default?: PuppeteerModule }).default ?? puppeteerCoreMod
          if (typeof (chromium as { executablePath?: () => Promise<string> }).executablePath === "function") {
            executablePath = await (chromium as { executablePath: () => Promise<string> }).executablePath()
            chromiumArgs = (chromium as { args: string[] }).args
            puppeteer = puppeteerCore as PuppeteerModule
          }
        }
      } catch {
        /* fall through to optional puppeteer / system Chrome */
      }
    }

    // 2) Full puppeteer (optional dependency — bundles Chromium for dev)
    if (!puppeteer) {
      try {
        // @ts-expect-error — optional package; not listed in package.json types
        const full = await import(/* webpackIgnore: true */ "puppeteer").catch(() => null)
        if (full) {
          puppeteer = ((full as { default?: PuppeteerModule }).default ?? full) as PuppeteerModule
          executablePath = undefined
          chromiumArgs = undefined
        }
      } catch {
        /* optional */
      }
    }

    // 3) puppeteer-core + installed Chrome/Chromium on the machine
    if (!puppeteer) {
      const puppeteerCoreMod = await import(/* webpackIgnore: true */ "puppeteer-core").catch(() => null)
      const sys = resolveSystemChromeExecutable()
      if (puppeteerCoreMod && sys) {
        puppeteer = ((puppeteerCoreMod as { default?: PuppeteerModule }).default ??
          puppeteerCoreMod) as PuppeteerModule
        executablePath = sys
        chromiumArgs = ["--no-sandbox", "--disable-setuid-sandbox"]
      }
    }

    if (!puppeteer) {
      return {
        pdf: null,
        error:
          "Could not start a browser for PDF export. On Mac/Windows install Google Chrome, or set PUPPETEER_EXECUTABLE_PATH to your Chrome/Chromium binary.",
      }
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: chromiumArgs ?? ["--no-sandbox", "--disable-setuid-sandbox"],
      ...(executablePath ? { executablePath } : {}),
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
    let msg = e instanceof Error ? errorMessage(e) : "PDF generation failed"
    if (/enoexec|exec format error/i.test(msg)) {
      msg =
        "Chrome/Chromium binary could not run (wrong OS or architecture). On Mac, install Google Chrome or set PUPPETEER_EXECUTABLE_PATH to your Chrome app binary."
    }
    console.error("[htmlToPdfBuffer]", msg)
    return { pdf: null, error: msg }
  }
}
