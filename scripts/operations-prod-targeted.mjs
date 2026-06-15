#!/usr/bin/env node
/**
 * Targeted production checks after Operations deploy.
 *   node scripts/operations-prod-targeted.mjs
 */

import { chromium } from "playwright"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")

function fullUrl(pathname) {
  return `${baseURL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

const checks = []

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail })
  const mark = ok ? "OK" : "FAIL"
  console.log(`  ${name} ... ${mark}${detail ? ` — ${detail}` : ""}`)
}

async function checkCrons() {
  console.log("\n--- Cron endpoints (x-vercel-cron) ---\n")
  for (const path of ["/api/cron/scan-delivery-delays", "/api/cron/scan-dispatch-events"]) {
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

async function checkUi() {
  console.log("\n--- Dispatch settings UI ---\n")
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(fullUrl("/demo/setup"), { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 180_000 })

    await page.goto(fullUrl("/dashboard/settings/dispatch"), {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    })
    await page.waitForTimeout(3000)

    const body = await page.locator("body").innerText()
    record("Notify on Dispatch toggle", /notify on dispatch/i.test(body))
    record("Notification channels section", /notification channels/i.test(body))
    record("Push channel option", /\bpush\b/i.test(body))
    record("Email channel option", /\bemail\b/i.test(body))
    record("In app channel option", /in app/i.test(body))

    const pushCheckbox = page.getByRole("checkbox", { name: /^push$/i })
    const pushVisible = await pushCheckbox.isVisible().catch(() => false)
    record("Push checkbox visible", pushVisible)

    const fatal = []
    page.on("pageerror", (e) => fatal.push(String(e)))
    await page.waitForTimeout(500)
    record("No fatal page errors", fatal.length === 0, fatal[0] ?? "")
  } finally {
    await browser.close()
  }
}

async function checkFirebaseConfig() {
  console.log("\n--- Firebase push config ---\n")
  try {
    const res = await fetch(fullUrl("/firebase-messaging-sw.js"))
    const body = await res.text()
    const hasAppId = /"appId":"1:\d+:web:[^"]+"/.test(body)
    const hasProject = /truckmates-a8948/.test(body)
    record("Firebase messaging SW", res.status === 200 && hasAppId, hasAppId ? "appId configured" : body.slice(0, 80))
    record("Firebase project ID", hasProject, hasProject ? "truckmates-a8948" : "missing")
  } catch (e) {
    record("Firebase messaging SW", false, String(e))
  }
}

console.log(`\n=== Operations Targeted Prod Checks (${baseURL}) ===`)
await checkCrons()
await checkUi()
await checkFirebaseConfig()

const failed = checks.filter((c) => !c.ok)
console.log(`\n=== Summary: ${checks.length - failed.length}/${checks.length} passed ===\n`)
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail || "failed"}`)
  process.exit(1)
}
