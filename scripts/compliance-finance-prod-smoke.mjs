#!/usr/bin/env node
/**
 * Compliance & Finance production smoke test.
 *   PLAYWRIGHT_BASE_URL=https://www.truckmateslogistic.com PLAYWRIGHT_AUTH=demo node scripts/compliance-finance-prod-smoke.mjs
 */

import { chromium } from "playwright"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")
const authMode = (process.env.PLAYWRIGHT_AUTH || "demo").toLowerCase()

const PATHS = [
  "/dashboard/compliance",
  "/dashboard/dvir",
  "/dashboard/ifta",
  "/dashboard/accounting/invoices",
  "/dashboard/accounting/settlements",
  "/dashboard/settings/invoice",
  "/dashboard/settings/compliance",
  "/dashboard/settings/factoring",
  "/dashboard/payables/vendor-invoices",
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
  throw new Error("Only demo auth supported for smoke script")
}

const results = []

console.log(`\n=== Compliance & Finance Prod Smoke (${baseURL}) ===\n`)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  await authenticate(page)
  for (const path of PATHS) {
    const started = Date.now()
    let ok = true
    try {
      const res = await page.goto(fullUrl(path), { waitUntil: "domcontentloaded", timeout: 90_000 })
      if ((res?.status() ?? 0) >= 400) ok = false
      await page.waitForTimeout(2000)
      const body = await page.locator("body").innerText()
      if (/internal server error|application error/i.test(body)) ok = false
    } catch {
      ok = false
    }
    results.push({ path, ok, ms: Date.now() - started })
    console.log(`  ${path} ... ${ok ? "OK" : "FAIL"} (${results[results.length - 1].ms}ms)`)
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===\n`)
if (failed.length) process.exit(1)
