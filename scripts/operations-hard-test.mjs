#!/usr/bin/env node
/**
 * Static hard test for TruckMates Operations section.
 * Validates routes, server actions, SQL tables/RPCs, and settings wiring.
 *
 * Run: node scripts/operations-hard-test.mjs
 */

import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

const OPERATIONS_ROUTES = [
  "app/dashboard/loads/page.tsx",
  "app/dashboard/loads/add/page.tsx",
  "app/dashboard/loads/[id]/page.tsx",
  "app/dashboard/loads/[id]/edit/page.tsx",
  "app/dashboard/loads/[id]/trip/page.tsx",
  "app/dashboard/dispatches/page.tsx",
  "app/dashboard/dispatches/ltl/page.tsx",
  "app/dashboard/dispatches/check-calls/page.tsx",
  "app/dashboard/routes/page.tsx",
  "app/dashboard/routes/add/page.tsx",
  "app/dashboard/routes/optimize/page.tsx",
  "app/dashboard/routes/[id]/page.tsx",
  "app/dashboard/routes/[id]/edit/page.tsx",
  "app/dashboard/drivers/page.tsx",
  "app/dashboard/drivers/add/page.tsx",
  "app/dashboard/drivers/[id]/page.tsx",
  "app/dashboard/drivers/[id]/edit/page.tsx",
  "app/dashboard/drivers/[id]/onboarding/page.tsx",
  "app/dashboard/trucks/page.tsx",
  "app/dashboard/trucks/add/page.tsx",
  "app/dashboard/trucks/[id]/page.tsx",
  "app/dashboard/trucks/[id]/edit/page.tsx",
  "app/dashboard/trailers/page.tsx",
  "app/dashboard/trailers/add/page.tsx",
  "app/dashboard/trailers/[id]/edit/page.tsx",
  "app/dashboard/fleet-map/page.tsx",
  "app/dashboard/settings/load/page.tsx",
  "app/dashboard/settings/dispatch/page.tsx",
]

const OPERATIONS_ACTIONS = [
  "app/actions/loads.ts",
  "app/actions/dispatches.ts",
  "app/actions/routes.ts",
  "app/actions/drivers.ts",
  "app/actions/trucks.ts",
  "app/actions/trailers.ts",
  "app/actions/permits.ts",
  "app/actions/ltl-shipments.ts",
  "app/actions/load-templates.ts",
  "app/actions/load-delivery-points.ts",
  "app/actions/route-stops.ts",
  "app/actions/dispatch-assist.ts",
  "app/actions/dispatch-timeline.ts",
  "app/actions/check-calls.ts",
  "app/actions/geofencing.ts",
  "app/actions/number-formats.ts",
]

const REQUIRED_TABLES = [
  "loads",
  "drivers",
  "trucks",
  "trailers",
  "routes",
  "permits",
  "shipments",
  "truck_movements",
  "movement_shipments",
  "load_delivery_points",
  "route_stops",
  "load_templates",
  "check_calls",
  "geofences",
  "company_settings",
]

const REQUIRED_RPCS = ["assign_load_transactional", "check_pre_trip_dvir_required"]

const SETTINGS_UI_FIELDS = [
  "require_bol_before_dispatch",
  "require_documents_before_dispatch",
  "auto_assign_driver",
  "auto_assign_truck",
  "allow_status_skip",
  "require_confirmation_before_dispatch",
  "dispatch_approval_required",
]

let failures = 0
let warnings = 0

function fail(msg) {
  console.error(`  ✗ ${msg}`)
  failures += 1
}

function warn(msg) {
  console.warn(`  ⚠ ${msg}`)
  warnings += 1
}

function pass(msg) {
  console.log(`  ✓ ${msg}`)
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8")
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file))
}

function allSqlText() {
  const dirs = ["supabase/migrations", "supabase"]
  const chunks = []
  for (const dir of dirs) {
    const full = path.join(ROOT, dir)
    if (!fs.existsSync(full)) continue
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith(".sql")) chunks.push(read(path.join(dir, name)))
    }
  }
  return chunks.join("\n")
}

console.log("\n=== Operations Hard Test ===\n")

console.log("1. Dashboard routes")
for (const route of OPERATIONS_ROUTES) {
  if (!exists(route)) fail(`Missing route file: ${route}`)
  else pass(route)
}

console.log("\n2. Server action files")
for (const action of OPERATIONS_ACTIONS) {
  if (!exists(action)) fail(`Missing action file: ${action}`)
  else {
    const src = read(action)
    if (!src.includes('"use server"')) warn(`${action} missing "use server" directive`)
    pass(action)
  }
}

console.log("\n3. SQL tables referenced by Operations actions")
const sql = allSqlText()
for (const table of REQUIRED_TABLES) {
  const pattern = new RegExp(`(CREATE TABLE IF NOT EXISTS public\\.${table}|CREATE TABLE public\\.${table}|FROM public\\.${table}|\\.from\\(["']${table}["']\\))`, "i")
  const inSql = sql.includes(`public.${table}`) || sql.includes(`"${table}"`) || sql.includes(`'${table}'`)
  const inActions = OPERATIONS_ACTIONS.some((f) => read(f).includes(`"${table}"`) || read(f).includes(`'${table}'`))
  if (!inSql && inActions) fail(`Table "${table}" used in actions but not found in SQL migrations`)
  else pass(`table ${table}`)
}

console.log("\n4. RPC functions used by dispatch")
for (const rpc of REQUIRED_RPCS) {
  if (!sql.includes(rpc)) fail(`RPC "${rpc}" not defined in SQL`)
  else pass(`rpc ${rpc}`)
}

const dispatchesSrc = read("app/actions/dispatches.ts")
for (const param of [
  "p_load_id",
  "p_company_id",
  "p_truck_id",
  "p_driver_id",
  "p_assigned_by",
  "p_set_status",
  "p_new_status",
]) {
  if (!dispatchesSrc.includes(param)) fail(`dispatches.ts missing RPC param ${param}`)
  else pass(`dispatches RPC param ${param}`)
}

console.log("\n5. Load settings UI ↔ persistence wiring")
const loadSettingsUi = read("app/dashboard/settings/load/page.tsx")
const dispatchSettingsUi = read("app/dashboard/settings/dispatch/page.tsx")
const numberFormats = read("app/actions/number-formats.ts")

for (const field of SETTINGS_UI_FIELDS) {
  const inUi = loadSettingsUi.includes(field) || dispatchSettingsUi.includes(field)
  if (!inUi) continue
  const inAllowed = numberFormats.includes(`'${field}'`) || numberFormats.includes(`"${field}"`)
  const inSelect = numberFormats.includes(field)
  const inSqlCol = sql.includes(field)
  if (inUi && !inAllowed) fail(`Settings field "${field}" shown in UI but not in updateCompanySettings allowedFields`)
  else if (inUi && inAllowed) pass(`settings field ${field} in allowedFields`)
  if (inUi && !inSqlCol) warn(`Settings field "${field}" has no SQL column migration yet`)
  if (inUi && !inSelect && inAllowed) warn(`Settings field "${field}" not in COMPANY_SETTINGS_SELECT (load may not round-trip)`)
}

console.log("\n6. Dispatch gate enforcement in code")
const loadsSrc = read("app/actions/loads.ts")
const gates = [
  { name: "permit attachment gate", pattern: /Permit attachment is required before dispatching/ },
  { name: "HAZMAT fields gate", pattern: /HAZMAT loads require UN number/ },
  { name: "HAZMAT endorsement gate", pattern: /HAZMAT endorsement \(H\)/ },
]
for (const gate of gates) {
  if (gate.pattern.test(loadsSrc) || gate.pattern.test(dispatchesSrc)) pass(gate.name)
  else fail(`Missing ${gate.name}`)
}

if (/require_bol_before_dispatch/.test(loadsSrc) || /require_bol_before_dispatch/.test(dispatchesSrc)) {
  pass("require_bol_before_dispatch enforced in dispatch path")
} else {
  warn("require_bol_before_dispatch UI exists but is not enforced in loads/dispatches actions")
}

if (/getDispatchGateErrors/.test(dispatchesSrc)) pass("dispatch board uses shared dispatch gate checks")
else warn("dispatches.ts missing shared dispatch gate checks")

console.log("\n7. Shared permit logic module")
if (exists("lib/permit-requirement.ts")) pass("lib/permit-requirement.ts exists")
else fail("lib/permit-requirement.ts missing")

if (loadsSrc.includes("permit-requirement")) pass("loads.ts imports shared permit module")
else warn("loads.ts still uses inline computePermitRequirement")

console.log("\n8. TypeScript config (build health)")
const tsconfig = JSON.parse(read("tsconfig.json"))
const staleIncludes = (tsconfig.include || []).filter((p) => String(p).includes(".cache/truckmates-next"))
if (staleIncludes.length > 0) warn(`tsconfig.json includes stale cache paths: ${staleIncludes.join(", ")}`)
else pass("tsconfig.json has no stale external .next cache paths")

console.log(`\n=== Summary: ${failures} failure(s), ${warnings} warning(s) ===\n`)
process.exit(failures > 0 ? 1 : 0)
