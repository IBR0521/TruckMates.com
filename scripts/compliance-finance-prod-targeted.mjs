#!/usr/bin/env node
/**
 * Targeted production checks after Compliance & Finance deploy.
 *   node scripts/compliance-finance-prod-targeted.mjs
 */

import { chromium } from "playwright"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")

function fullUrl(pathname) {
  return `${baseURL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

const checks = []

async function mainContentText(page) {
  const main = page.locator("#main-content")
  await main.waitFor({ state: "visible", timeout: 20_000 })
  await main.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(500)
  return main.innerText()
}

async function waitForMainReady(page) {
  await page.locator("#main-content").waitFor({ state: "visible", timeout: 20_000 })
  await page.waitForFunction(
    () => {
      const text = document.querySelector("#main-content")?.textContent || ""
      if (/checking plan access/i.test(text)) return false
      if (/^loading/i.test(text.trim())) return false
      return text.trim().length > 40
    },
    { timeout: 25_000 },
  )
  await page.waitForTimeout(1000)
}

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail })
  const mark = ok ? "OK" : "FAIL"
  console.log(`  ${name} ... ${mark}${detail ? ` — ${detail}` : ""}`)
}

async function checkCrons() {
  console.log("\n--- Compliance & Finance cron endpoints (x-vercel-cron) ---\n")
  for (const path of [
    "/api/cron/scan-document-expiry",
    "/api/cron/scan-permit-expiry",
    "/api/cron/scan-invoice-overdue",
    "/api/cron/sync-factoring-status",
  ]) {
    try {
      const res = await fetch(fullUrl(path), {
        headers: { "x-vercel-cron": "1" },
      })
      const body = await res.text()
      let parsed = null
      try {
        parsed = JSON.parse(body)
      } catch {
        parsed = { raw: body.slice(0, 120) }
      }
      const ok = res.status === 200 && parsed?.success === true
      record(path, ok, `HTTP ${res.status} ${JSON.stringify(parsed?.data ?? parsed?.error ?? parsed).slice(0, 100)}`)
    } catch (e) {
      record(path, false, String(e))
    }
  }
}

async function checkComplianceSettingsUi(page) {
  console.log("\n--- Compliance settings UI ---\n")
  await page.goto(fullUrl("/dashboard/settings/compliance"), {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  })
  await waitForMainReady(page)
  const body = await mainContentText(page)

  record("Compliance settings page title", /compliance settings/i.test(body))
  record("DOT number field", /dot number/i.test(body))
  record("HOS hard-block toggle", /block dispatch when driver is out of hours/i.test(body))
  record("Expiry lead days", /lead days/i.test(body))
  record("Document expiry toggle", /document.*expiry/i.test(body))
  record("Permit expiry toggle", /permit expiry/i.test(body))
  record("Notification channels section", /notification channels/i.test(body))
  record("Email channel option", /\bemail\b/i.test(body))
  record("In app channel option", /in app/i.test(body))
}

async function checkInvoiceSettingsUi(page) {
  console.log("\n--- Invoice / finance settings UI ---\n")
  await page.goto(fullUrl("/dashboard/settings/invoice"), {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  })
  await waitForMainReady(page)
  const body = await mainContentText(page)

  record("Invoice settings loads", /invoice settings|invoice taxes/i.test(body))
  record("Auto-invoice on delivery toggle", /auto-generate on delivery/i.test(body))
  record("Tax enabled section", /invoice taxes/i.test(body))
  record("Notify on overdue invoices", /notify on overdue invoices/i.test(body))
  record("Notify on factoring status", /notify on factoring status/i.test(body))
  record("Finance notification channels", /finance notifications/i.test(body))
}

async function checkIntegrationFuelCardUi(page) {
  console.log("\n--- Fuel card integration UI ---\n")
  await page.goto(fullUrl("/dashboard/settings/integration"), {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  })
  await waitForMainReady(page)
  await page
    .locator("#main-content")
    .getByText(/fuel card imports/i)
    .waitFor({ timeout: 25_000 })
  const body = await mainContentText(page)

  record("Fuel card imports section", /fuel card/i.test(body))
  record("Comdata provider", /comdata/i.test(body))
  record("WEX provider", /\bwex\b/i.test(body))
  record("EFS provider", /\befs\b/i.test(body))
}

async function checkPlanGatedPages(page) {
  console.log("\n--- Plan-gated pages (lock or content) ---\n")
  for (const [path, patterns] of [
    ["/dashboard/hazmat", [/hazmat loads|hazmat module|upgrade/i]],
    ["/dashboard/edi", [/edi|tender|upgrade/i]],
    ["/dashboard/permits", [/permits|permit management|upgrade/i]],
    ["/dashboard/payables/vendor-invoices", [/vendor invoice|payables|upgrade/i]],
  ]) {
    await page.goto(fullUrl(path), { waitUntil: "domcontentloaded", timeout: 90_000 })
    await waitForMainReady(page)
    const body = await mainContentText(page)
    const label = path.split("/").pop()
    const renders = patterns.some((re) => re.test(body))
    record(`${label} page renders`, renders, renders ? "ok" : body.slice(0, 80).replace(/\s+/g, " "))
    record(`${label} no server error`, !/internal server error|application error/i.test(body))
  }
}

async function checkUi() {
  console.log("\n--- Authenticated UI checks ---\n")
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const fatal = []
  page.on("pageerror", (e) => fatal.push(String(e)))

  try {
    await page.goto(fullUrl("/demo/setup"), { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 180_000 })

    await checkComplianceSettingsUi(page)
    await checkInvoiceSettingsUi(page)
    await checkIntegrationFuelCardUi(page)
    await checkPlanGatedPages(page)

    await page.waitForTimeout(500)
    record("No fatal page errors", fatal.length === 0, fatal[0] ?? "")
  } finally {
    await browser.close()
  }
}

console.log(`\n=== Compliance & Finance Targeted Prod Checks (${baseURL}) ===`)
await checkCrons()
await checkUi()

const failed = checks.filter((c) => !c.ok)
console.log(`\n=== Summary: ${checks.length - failed.length}/${checks.length} passed ===\n`)
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail || "failed"}`)
  process.exit(1)
}
