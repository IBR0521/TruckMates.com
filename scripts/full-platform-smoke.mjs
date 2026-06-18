#!/usr/bin/env node
/**
 * Full platform smoke test — every page route discovered from app/page.tsx files.
 * Uses Playwright + demo auth for protected routes.
 *
 *   PLAYWRIGHT_BASE_URL=https://www.truckmateslogistic.com PLAYWRIGHT_AUTH=demo node scripts/full-platform-smoke.mjs
 */

import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")
const authMode = (process.env.PLAYWRIGHT_AUTH || "demo").toLowerCase()

function discoverRoutes() {
  const root = path.join(process.cwd(), "app")
  const out = new Set()
  const walk = (dir, prefix = "") => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith("_") || ent.name.startsWith("(")) continue
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(full, rel)
      } else if (ent.name === "page.tsx") {
        const route = prefix ? `/${prefix}` : "/"
        out.add(route.replace(/\[[^\]]+\]/g, "test-id"))
      }
    }
  }
  walk(root)
  return [...out].filter((r) => r !== "/page.tsx").sort()
}

const PUBLIC_PREFIXES = [
  "/",
  "/about",
  "/pricing",
  "/compliance",
  "/security",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/partners",
  "/integrations",
  "/developers",
  "/company",
  "/diagnostics",
  "/login",
  "/register",
  "/demo",
  "/marketplace",
  "/tracking/",
  "/portal/",
]

function isPublicRoute(route) {
  if (route === "/") return true
  if (route.startsWith("/dashboard") || route.startsWith("/billing/") || route.startsWith("/account-setup/")) {
    return false
  }
  return PUBLIC_PREFIXES.filter((p) => p !== "/").some((p) =>
    p.endsWith("/") ? route.startsWith(p) : route === p || route.startsWith(`${p}/`),
  )
}

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
  if (!email || !password) throw new Error("PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD required for login mode")
  await page.goto(fullUrl("/login"), { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 90_000 })
}

const FATAL_PATTERNS = [
  /internal server error/i,
  /something went wrong/i,
  /company_settings table does not exist/i,
  /reading 'call'/i,
  /webpack-runtime/i,
  /hydration failed/i,
  // Standalone error heading — exclude compliance copy like "application error output"
  /(^|\n)\s*application error\s*($|\n)/i,
]

function hasFatal(errors, bodyText) {
  if (FATAL_PATTERNS.some((p) => p.test(bodyText))) return true
  return errors.some(
    (e) =>
      /reading 'call'|webpack-runtime|company_settings table does not exist|hydration failed/i.test(e) &&
      !/preload but not used/i.test(e),
  )
}

const results = []

async function visit(page, pathname, { authenticated }) {
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
  let note = ""
  const started = Date.now()
  try {
    const res = await page.goto(fullUrl(pathname), { waitUntil: "domcontentloaded", timeout: 90_000 })
    status = res?.status() ?? null
    const finalPath = new URL(page.url()).pathname

    // Auth redirect is OK for protected routes when not authenticated
    if (!authenticated && !isPublicRoute(pathname)) {
      if (finalPath === "/login" || finalPath.startsWith("/billing/") || finalPath.startsWith("/account-setup/")) {
        note = "redirected (auth gate)"
        results.push({ pathname, ok: true, status, note, ms: Date.now() - started })
        return
      }
    }

    if (status != null && status >= 500) ok = false
    await page.waitForTimeout(1500)
    const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "")
    if (hasFatal([...consoleErrors, ...pageErrors], bodyText)) ok = false
    if (/not found|404/i.test(bodyText) && pathname.includes("test-id")) {
      note = "404 expected for placeholder id"
    }
    if (finalPath.includes("/settings/billing") && finalPath.includes("upgrade=")) {
      note = note ? `${note}; plan-gated` : "plan-gated redirect"
    }
    results.push({ pathname, ok, status, note, ms: Date.now() - started, errors: ok ? [] : [...consoleErrors, ...pageErrors].slice(0, 3) })
  } catch (err) {
    results.push({ pathname, ok: false, status, note: String(err.message).slice(0, 120), ms: Date.now() - started })
  } finally {
    page.off("console", onConsole)
    page.off("pageerror", onPageError)
  }
}

async function main() {
  const routes = discoverRoutes()
  const publicRoutes = routes.filter(isPublicRoute)
  const protectedRoutes = routes.filter((r) => !isPublicRoute(r))

  console.log(`Full platform smoke: ${routes.length} routes (${publicRoutes.length} public, ${protectedRoutes.length} protected)`)
  console.log(`Base URL: ${baseURL} | Auth: ${authMode}\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  for (const pathname of publicRoutes) {
    process.stdout.write(`  public ${pathname} ... `)
    await visit(page, pathname, { authenticated: false })
    const r = results[results.length - 1]
    console.log(r.ok ? "OK" : "FAIL", r.note || "")
  }

  await authenticate(page)
  for (const pathname of protectedRoutes) {
    process.stdout.write(`  auth ${pathname} ... `)
    await visit(page, pathname, { authenticated: true })
    const r = results[results.length - 1]
    console.log(r.ok ? "OK" : "FAIL", r.note || "")
  }

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  const passed = results.filter((r) => r.ok)
  const reportPath = path.join(process.cwd(), "full-platform-smoke-report.json")
  fs.writeFileSync(reportPath, JSON.stringify({ baseURL, authMode, summary: { total: results.length, passed: passed.length, failed: failed.length }, results }, null, 2))

  console.log(`\n=== Full Platform Smoke: ${passed.length}/${results.length} passed ===`)
  if (failed.length) {
    console.log("\nFailures:")
    for (const f of failed) {
      console.log(`  ✗ ${f.pathname} — status=${f.status} ${f.note}`)
      if (f.errors?.length) f.errors.forEach((e) => console.log(`      ${e.slice(0, 150)}`))
    }
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
