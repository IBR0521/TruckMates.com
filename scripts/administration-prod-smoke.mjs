#!/usr/bin/env node
/**
 * Administration production smoke test (Playwright).
 *   PLAYWRIGHT_BASE_URL=https://www.truckmateslogistic.com PLAYWRIGHT_AUTH=demo node scripts/administration-prod-smoke.mjs
 */

import { chromium } from "playwright"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")
const authMode = (process.env.PLAYWRIGHT_AUTH || "demo").toLowerCase()

const PATHS = [
  "/dashboard/settings/users",
  "/dashboard/settings/ai-automation",
  "/dashboard/settings/ai-automation/pending-approvals",
  "/dashboard/settings/api-keys",
  "/dashboard/settings/webhooks",
  "/dashboard/settings/multi-terminal",
  "/dashboard/settings/billing",
  "/dashboard/settings/portal",
  "/dashboard/settings/audit-logs",
  "/dashboard/settings",
]

function fullUrl(pathname) {
  return `${baseURL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

async function authenticate(page) {
  if (authMode === "demo") {
    await page.goto(fullUrl("/demo/setup"), { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 180_000 })
    return
  }
  throw new Error("Only demo auth supported")
}

const results = []

async function visit(page, pathname) {
  const consoleErrors = []
  const pageErrors = []
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  }
  const onPageError = (err) => pageErrors.push(String(err))
  page.on("console", onConsole)
  page.on("pageerror", onPageError)

  let ok = true
  let status = null
  const started = Date.now()
  try {
    const res = await page.goto(fullUrl(pathname), { waitUntil: "domcontentloaded", timeout: 90_000 })
    status = res?.status() ?? null
    const url = page.url()
    if (url.includes("/login")) {
      ok = false
    }
    if (status && status >= 500) ok = false
    await page.waitForTimeout(1500)
  } catch {
    ok = false
  } finally {
    page.off("console", onConsole)
    page.off("pageerror", onPageError)
  }

  const ms = Date.now() - started
  results.push({ pathname, ok, status, ms, consoleErrors, pageErrors })
  const mark = ok ? "✓" : "✗"
  console.log(`${mark} ${pathname} (${status ?? "?"}) ${ms}ms`)
  if (!ok) {
    if (pageErrors.length) console.log(`   page errors: ${pageErrors.slice(0, 2).join("; ")}`)
    if (consoleErrors.length) console.log(`   console: ${consoleErrors.slice(0, 2).join("; ")}`)
  }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  await authenticate(page)
  for (const pathname of PATHS) {
    await visit(page, pathname)
  }
} finally {
  await browser.close()
}

const passed = results.filter((r) => r.ok).length
const total = results.length
console.log(`\n=== ${passed}/${total} routes OK ===\n`)
if (passed < total) process.exit(1)
