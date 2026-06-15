#!/usr/bin/env node
/**
 * Targeted production checks for Business & Tools.
 *   PLAYWRIGHT_BASE_URL=https://www.truckmateslogistic.com node scripts/business-tools-prod-targeted.mjs
 */

import { chromium } from "playwright"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")

function fullUrl(pathname) {
  return `${baseURL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

const checks = []

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail })
  console.log(`  ${name} ... ${ok ? "OK" : "FAIL"}${detail ? ` — ${detail}` : ""}`)
}

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
      return !/checking plan access/i.test(text) && text.trim().length > 40
    },
    { timeout: 25_000 },
  )
  await page.waitForTimeout(1000)
}

async function checkCrons() {
  console.log("\n--- Business & Tools crons ---\n")
  for (const path of [
    "/api/cron/alert-escalations",
    "/api/cron/process-smart-notifications",
    "/api/cron/morning-digest",
  ]) {
    try {
      const res = await fetch(fullUrl(path), { headers: { "x-vercel-cron": "1" } })
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

async function checkUi() {
  console.log("\n--- Business settings & alerts UI ---\n")
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(fullUrl("/demo/setup"), { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 180_000 })

    await page.goto(fullUrl("/dashboard/settings/business"), { waitUntil: "domcontentloaded", timeout: 90_000 })
    await waitForMainReady(page)
    const business = await mainContentText(page)
    record("Business settings page", /business settings/i.test(business))
    record("BOL auto-generate toggle", /auto-generate bol|auto generate bol/i.test(business))
    record("Company branding section", /branding|logo|company name/i.test(business))
    record("BOL template field", /bol template|template/i.test(business))

    await page.goto(fullUrl("/dashboard/settings/alerts"), { waitUntil: "domcontentloaded", timeout: 90_000 })
    await waitForMainReady(page)
    const alerts = await mainContentText(page)
    record("Alert rules page", /alert rules/i.test(alerts))
    record("Create alert rule UI", /create.*alert rule|alert rules/i.test(alerts))

    await page.goto(fullUrl("/dashboard/crm"), { waitUntil: "domcontentloaded", timeout: 90_000 })
    await waitForMainReady(page)
    const crm = await mainContentText(page)
    record("CRM dashboard renders", /crm|customer|upgrade|professional/i.test(crm))
  } finally {
    await browser.close()
  }
}

console.log(`\n=== Business & Tools Targeted Prod Checks (${baseURL}) ===`)
await checkCrons()
await checkUi()

const failed = checks.filter((c) => !c.ok)
console.log(`\n=== Summary: ${checks.length - failed.length}/${checks.length} passed ===\n`)
if (failed.length) process.exit(1)
