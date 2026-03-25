#!/usr/bin/env node
/**
 * TruckMates dashboard smoke test (Playwright).
 *
 * Setup:
 *   npm install
 *   npx playwright install chromium
 *
 * Run:
 *   node scripts/truckmates-smoke.mjs
 *   npm run e2e:smoke
 *
 * Local app (fixes ERR_CONNECTION_REFUSED):
 *   Terminal 1: npm run dev
 *   Terminal 2: PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e:smoke
 *
 * Navigation: skips a redundant full reload when already on /dashboard after login;
 * prefers clicking sidebar <Link>s (client-side nav) when possible, else page.goto.
 *
 * Env:
 *   PLAYWRIGHT_BASE_URL   — default https://truckmateslogistic.com
 *   PLAYWRIGHT_AUTH       — "login" (default) or "demo" (/demo/setup then dashboard)
 *   PLAYWRIGHT_EMAIL      — required for login mode
 *   PLAYWRIGHT_PASSWORD   — required for login mode
 */

import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://truckmateslogistic.com").replace(
  /\/$/,
  "",
)
const authMode = (process.env.PLAYWRIGHT_AUTH || "login").toLowerCase()

function connectionHint(err) {
  const msg = String(err?.message ?? err)
  if (!/ERR_CONNECTION_REFUSED|ECONNREFUSED|NS_ERROR_CONNECTION_REFUSED/i.test(msg)) {
    return ""
  }
  return (
    "\n\n→ Connection refused: nothing is listening at that host/port.\n" +
    "  • Local: run `npm run dev` first, then set PLAYWRIGHT_BASE_URL=http://localhost:3000\n" +
    "  • Production: confirm the site is up and the URL in PLAYWRIGHT_BASE_URL is correct.\n"
  )
}

/** Core routes aligned with sidebar (subset for ~1–2 min runs). */
const DASHBOARD_PATHS = [
  "/dashboard",
  "/dashboard/loads",
  "/dashboard/dispatches",
  "/dashboard/drivers",
  "/dashboard/trucks",
  "/dashboard/routes",
  "/dashboard/fleet-map",
  "/dashboard/address-book",
  "/dashboard/crm",
  "/dashboard/customers",
  "/dashboard/accounting/invoices",
  "/dashboard/accounting/expenses",
  "/dashboard/accounting/settlements",
  "/dashboard/maintenance",
  "/dashboard/dvir",
  "/dashboard/eld",
  "/dashboard/ifta",
  "/dashboard/documents",
  "/dashboard/bols",
  "/dashboard/alerts",
  "/dashboard/settings",
  "/dashboard/all-features",
]

function fullUrl(pathname) {
  return `${baseURL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

/** Normalize pathname for comparison (no trailing slash except root). */
function normalizePathname(path) {
  if (!path || path === "/") return "/"
  return path.replace(/\/+$/, "") || "/"
}

async function authenticate(page) {
  if (authMode === "demo") {
    await page.goto(fullUrl("/demo/setup"), { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.waitForURL(
      (url) => url.pathname.startsWith("/dashboard"),
      { timeout: 180_000 },
    )
    return
  }

  const email = process.env.PLAYWRIGHT_EMAIL
  const password = process.env.PLAYWRIGHT_PASSWORD
  if (!email || !password) {
    throw new Error(
      "PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD are required when PLAYWRIGHT_AUTH=login (or set PLAYWRIGHT_AUTH=demo).",
    )
  }

  await page.goto(fullUrl("/login"), { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL(
    (url) => url.pathname.startsWith("/dashboard"),
    { timeout: 90_000 },
  )
}

/**
 * Prefer in-app <Link> clicks so Next.js can do client-side navigation (less “full reload” flash).
 * Falls back to page.goto when the link is not in the DOM (collapsed submenu, etc.).
 */
async function navigateInApp(page, pathname) {
  const href = pathname.startsWith("/") ? pathname : `/${pathname}`
  const link = page.locator(`a[href="${href}"]`).first()
  const count = await link.count().catch(() => 0)
  if (count > 0) {
    try {
      await link.scrollIntoViewIfNeeded({ timeout: 5_000 })
      await link.click({ timeout: 15_000 })
      await page.waitForURL(
        (url) => normalizePathname(url.pathname) === normalizePathname(href),
        { timeout: 45_000 },
      )
      return { nav: "click", status: 200 }
    } catch {
      // Hidden submenu / intercepting overlay — fall through to full navigation
    }
  }
  const response = await page.goto(fullUrl(pathname), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  })
  return {
    nav: "goto",
    status: response?.status() ?? null,
  }
}

async function visitPage(page, pathname) {
  const consoleErrors = []
  const pageErrors = []

  const onConsole = (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  }
  const onPageError = (err) => {
    pageErrors.push(String(err))
  }

  page.on("console", onConsole)
  page.on("pageerror", onPageError)

  const started = Date.now()
  let status = null
  let ok = true
  let nav = "skip"

  try {
    const current = normalizePathname(new URL(page.url()).pathname)
    const target = normalizePathname(pathname)

    // After login/demo we already land on /dashboard — avoid a pointless second full load of the same URL.
    if (current === target) {
      nav = "skip"
      status = 200
      await new Promise((r) => setTimeout(r, 300))
    } else {
      const result = await navigateInApp(page, pathname)
      nav = result.nav
      status = result.status
      if (status != null && status >= 400) ok = false
    }

    await new Promise((r) => setTimeout(r, 400))
  } catch (e) {
    ok = false
    pageErrors.push(String(e))
  } finally {
    page.off("console", onConsole)
    page.off("pageerror", onPageError)
  }

  const loadMs = Date.now() - started

  return {
    pathname,
    loadMs,
    httpStatus: status,
    ok,
    consoleErrors,
    pageErrors,
    nav,
  }
}

function printReport(rows, meta) {
  const lines = []
  lines.push("# TruckMates Playwright smoke report")
  lines.push("")
  lines.push(`- Base URL: ${meta.baseURL}`)
  lines.push(`- Auth: ${meta.authMode}`)
  lines.push(`- Finished: ${meta.finishedAt}`)
  lines.push("")
  lines.push("| Path | Load (ms) | HTTP | Nav | OK | Console err | Page err |")
  lines.push("|------|-----------|------|-----|-----|-------------|----------|")
  for (const r of rows) {
    lines.push(
      `| ${r.pathname} | ${r.loadMs} | ${r.httpStatus ?? "—"} | ${r.nav ?? "—"} | ${r.ok ? "yes" : "no"} | ${r.consoleErrors.length} | ${r.pageErrors.length} |`,
    )
  }
  lines.push("")
  const failed = rows.filter((r) => !r.ok || r.consoleErrors.length || r.pageErrors.length)
  if (failed.length) {
    lines.push("## Issues")
    lines.push("")
    for (const r of failed) {
      if (!r.ok || r.pageErrors.length) {
        lines.push(`### ${r.pathname}`)
        for (const e of r.pageErrors) lines.push(`- **page:** ${e}`)
        lines.push("")
      }
      if (r.consoleErrors.length) {
        lines.push(`### ${r.pathname} (console)`)
        for (const e of r.consoleErrors.slice(0, 8)) lines.push(`- ${e}`)
        if (r.consoleErrors.length > 8) lines.push(`- … (${r.consoleErrors.length - 8} more)`)
        lines.push("")
      }
    }
  } else {
    lines.push("No failures or console/page errors recorded.")
    lines.push("")
  }

  const text = lines.join("\n")
  console.log(text)
  return text
}

async function main() {
  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch (e) {
    console.error(
      "Failed to launch Chromium. Run: npx playwright install chromium\n",
      e?.message || e,
    )
    process.exit(1)
  }

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
  })
  const page = await context.newPage()

  const meta = {
    baseURL,
    authMode,
    finishedAt: new Date().toISOString(),
  }

  try {
    await authenticate(page)
  } catch (e) {
    console.error("Authentication failed:", e?.message || e, connectionHint(e))
    await browser.close()
    process.exit(1)
  }

  const rows = []
  for (const pathname of DASHBOARD_PATHS) {
    rows.push(await visitPage(page, pathname))
  }

  const reportMd = printReport(rows, meta)
  const reportPath = path.join(process.cwd(), "playwright-smoke-report.json")
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        meta,
        rows,
      },
      null,
      2,
    ),
    "utf8",
  )
  console.error(`\nJSON report written to ${reportPath}`)

  const hardFail = rows.some((r) => !r.ok)
  await browser.close()
  process.exit(hardFail ? 1 : 0)
}

main().catch((e) => {
  console.error(e?.message || e, connectionHint(e))
  process.exit(1)
})
