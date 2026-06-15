#!/usr/bin/env node
/**
 * Operations production smoke test (Playwright).
 * Uses live site + demo auth (hits real Supabase).
 *
 *   PLAYWRIGHT_BASE_URL=https://www.truckmateslogistic.com PLAYWRIGHT_AUTH=demo node scripts/operations-prod-smoke.mjs
 */

import { chromium } from "playwright"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")
const authMode = (process.env.PLAYWRIGHT_AUTH || "demo").toLowerCase()

const OPERATIONS_PATHS = [
  "/dashboard/loads",
  "/dashboard/dispatches",
  "/dashboard/dispatches?tab=check-calls",
  "/dashboard/routes",
  "/dashboard/drivers",
  "/dashboard/trucks",
  "/dashboard/trailers",
  "/dashboard/fleet-map",
  "/dashboard/settings/load",
  "/dashboard/settings/dispatch",
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
  const email = process.env.PLAYWRIGHT_EMAIL
  const password = process.env.PLAYWRIGHT_PASSWORD
  if (!email || !password) {
    throw new Error("PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD required for login mode")
  }
  await page.goto(fullUrl("/login"), { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 90_000 })
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
    if (status != null && status >= 400) ok = false
    await page.waitForTimeout(2500)
    const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "")
    if (/internal server error|application error|something went wrong/i.test(bodyText)) ok = false
    if (/company_settings table does not exist/i.test(bodyText)) ok = false
    const fatal = [...consoleErrors, ...pageErrors].filter(
      (e) =>
        /reading 'call'|webpack-runtime|company_settings table does not exist|hydration failed/i.test(e) &&
        !/preload but not used/i.test(e),
    )
    if (fatal.length) ok = false
    results.push({
      pathname,
      ok,
      status,
      ms: Date.now() - started,
      fatal,
      consoleErrors: consoleErrors.slice(0, 3),
    })
  } catch (e) {
    results.push({
      pathname,
      ok: false,
      status,
      ms: Date.now() - started,
      fatal: [String(e)],
      consoleErrors: [],
    })
  } finally {
    page.off("console", onConsole)
    page.off("pageerror", onPageError)
  }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  console.log(`\n=== Operations Production Smoke (${baseURL}) ===\n`)
  await authenticate(page)
  console.log(`Authenticated via ${authMode} → ${page.url()}\n`)
  for (const path of OPERATIONS_PATHS) {
    process.stdout.write(`  ${path} ... `)
    await visit(page, path)
    const r = results[results.length - 1]
    console.log(r.ok ? `OK (${r.ms}ms)` : `FAIL (${r.ms}ms)`)
    if (!r.ok) {
      if (r.fatal?.length) console.log(`    ${r.fatal[0]}`)
      if (r.consoleErrors?.length) console.log(`    console: ${r.consoleErrors[0]}`)
    }
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===\n`)
if (failed.length) process.exit(1)
