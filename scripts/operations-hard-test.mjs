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
const loadDispatchValidationSrc = exists("lib/load-dispatch-validation.ts")
  ? read("lib/load-dispatch-validation.ts")
  : ""
const gateSources = `${loadsSrc}\n${dispatchesSrc}\n${loadDispatchValidationSrc}\n${
  exists("lib/dispatch-gates.ts") ? read("lib/dispatch-gates.ts") : ""
}`
const gates = [
  { name: "permit attachment gate", pattern: /Permit attachment is required before dispatching/ },
  { name: "HAZMAT fields gate", pattern: /HAZMAT loads require UN number/ },
  { name: "HAZMAT endorsement gate", pattern: /HAZMAT endorsement \(H\)/ },
]
for (const gate of gates) {
  if (gate.pattern.test(gateSources)) pass(gate.name)
  else fail(`Missing ${gate.name}`)
}

if (/require_bol_before_dispatch/.test(gateSources)) {
  pass("require_bol_before_dispatch enforced in dispatch path")
} else {
  warn("require_bol_before_dispatch UI exists but is not enforced in dispatch actions")
}

if (/getDispatchGateErrors/.test(gateSources)) pass("dispatch paths use shared dispatch gate checks")
else warn("shared dispatch gate checks missing from dispatch actions")

console.log("\n7. Shared permit logic module")
if (exists("lib/permit-requirement.ts")) pass("lib/permit-requirement.ts exists")
else fail("lib/permit-requirement.ts missing")

if (exists("lib/load-dispatch-validation.ts")) pass("lib/load-dispatch-validation.ts exists")
else fail("lib/load-dispatch-validation.ts missing")

const loadDispatchValidation = exists("lib/load-dispatch-validation.ts")
  ? read("lib/load-dispatch-validation.ts")
  : ""
const apiLoadPatch = read("app/api/v1/loads/[id]/route.ts")

if (loadDispatchValidation.includes("getDispatchReadinessError")) pass("shared dispatch readiness helper exists")
else fail("lib/load-dispatch-validation.ts missing getDispatchReadinessError")

if (apiLoadPatch.includes("getDispatchReadinessError")) pass("public API PATCH enforces dispatch readiness")
else fail("app/api/v1/loads/[id]/route.ts bypasses dispatch validation")

const apiLoadPost = read("app/api/v1/loads/route.ts")
if (apiLoadPost.includes("Cannot create a load directly as scheduled")) {
  pass("public API POST blocks direct scheduled/in_transit create")
} else {
  fail("app/api/v1/loads/route.ts allows unsafe direct dispatch create")
}

if (/allow_status_skip/.test(loadsSrc) && loadsSrc.includes("isLoadStatusTransitionAllowed")) {
  pass("allow_status_skip wired into updateLoad transitions")
} else {
  warn("allow_status_skip not enforced in updateLoad")
}

if (loadsSrc.includes("allow_bulk_dispatch") && loadsSrc.includes("bulkAssignLoads")) {
  pass("allow_bulk_dispatch wired into bulkAssignLoads")
} else {
  warn("allow_bulk_dispatch not enforced in bulkAssignLoads")
}

if (numberFormats.includes("required_documents")) pass("required_documents persisted in company settings")
else warn("required_documents missing from number-formats persistence")

const migration237 = read("supabase/migrations/237_20260614000000_add_operations_notification_settings.sql")
const migration236 = exists("supabase/migrations/236_20260613000000_add_operations_workflow_settings.sql")
  ? read("supabase/migrations/236_20260613000000_add_operations_workflow_settings.sql")
  : ""
for (const col of [
  "dispatch_approval_required",
  "auto_dispatch_on_ready",
  "allow_bulk_dispatch",
  "allow_status_skip",
]) {
  if (migration236.includes(col) && numberFormats.includes(col)) pass(`migration 236 + settings: ${col}`)
  else if (!migration236) warn("migration 236 file missing")
  else warn(`migration 236 / settings mismatch: ${col}`)
}
for (const col of [
  "notify_on_load_created",
  "notify_on_status_change",
  "notify_on_delivery",
  "notify_driver_on_assignment",
  "notify_on_delivery_delay",
  "required_statuses",
]) {
  if (migration237.includes(col) && numberFormats.includes(col)) pass(`migration 237 + settings: ${col}`)
  else if (migration237.includes(col)) warn(`migration 237 has ${col} but number-formats does not persist it`)
  else warn(`migration 237 missing column ${col}`)
}

if (loadsSrc.includes("permit-requirement")) pass("loads.ts imports shared permit module")
else warn("loads.ts still uses inline computePermitRequirement")

console.log("\n9. Remaining Operations gap wiring")
if (dispatchesSrc.includes("getRouteLoadsDispatchReadinessError")) {
  pass("quickAssignRoute enforces dispatch readiness for linked loads")
} else {
  fail("quickAssignRoute missing route-level dispatch gate checks")
}

const autoAssignSrc = exists("lib/load-auto-assign.ts") ? read("lib/load-auto-assign.ts") : ""
if (autoAssignSrc.includes("haversineMiles") && autoAssignSrc.includes("max_distance_for_auto_assign")) {
  pass("auto-assign honors max_distance_for_auto_assign with proximity")
} else {
  fail("lib/load-auto-assign.ts does not enforce max_distance_for_auto_assign")
}

if (loadSettingsUi.includes("required_statuses") && loadSettingsUi.includes("allow_status_skip")) {
  pass("load settings UI exposes required_statuses when skip is enabled")
} else {
  fail("load settings UI missing required_statuses editor")
}

if (exists("app/api/cron/scan-delivery-delays/route.ts")) {
  pass("delivery delay cron route exists")
} else {
  fail("app/api/cron/scan-delivery-delays/route.ts missing")
}

const vercelJson = exists("vercel.json") ? read("vercel.json") : ""
if (vercelJson.includes("/api/cron/scan-delivery-delays")) {
  pass("vercel.json schedules delivery delay scan")
} else {
  warn("vercel.json missing scan-delivery-delays cron entry")
}

if (exists("app/actions/delivery-delay-notify.ts")) {
  const delayNotify = read("app/actions/delivery-delay-notify.ts")
  if (delayNotify.includes("notify_on_delivery_delay")) pass("delivery delay scan respects notify_on_delivery_delay")
  else fail("delivery-delay-notify.ts ignores notify_on_delivery_delay setting")
} else {
  fail("app/actions/delivery-delay-notify.ts missing")
}

if (exists("app/actions/dispatch-event-notify.ts")) {
  const dispatchNotify = read("app/actions/dispatch-event-notify.ts")
  if (dispatchNotify.includes("isDispatchNotifyEventEnabled")) {
    pass("dispatch-event-notify respects company notification toggles")
  } else {
    fail("dispatch-event-notify.ts missing notification toggle checks")
  }
  if (dispatchNotify.includes("scanMissedCheckCallsForCompany")) pass("missed check call scanner exists")
  else fail("dispatch-event-notify.ts missing missed check call scan")
  if (dispatchNotify.includes("scanDriverLateForCompany")) pass("driver late scanner exists")
  else fail("dispatch-event-notify.ts missing driver late scan")
  if (dispatchNotify.includes("scanRouteDeviationsForCompany")) pass("route deviation scanner exists")
  else fail("dispatch-event-notify.ts missing route deviation scan")
} else {
  fail("app/actions/dispatch-event-notify.ts missing")
}

if (numberFormats.includes("notify_on_dispatch") && dispatchSettingsUi.includes("notify_on_dispatch")) {
  pass("notify_on_dispatch persisted from dispatch settings UI")
} else {
  fail("notify_on_dispatch not wired to number-formats persistence")
}

if (exists("lib/format-weight.ts") && loadSettingsUi.includes("weight_unit")) {
  pass("formatLoadWeight helper exists for weight_unit display")
} else {
  fail("weight_unit formatting helper missing")
}

const migration238 = exists("supabase/migrations/238_20260614100000_add_dispatch_settings_and_notifications.sql")
  ? read("supabase/migrations/238_20260614100000_add_dispatch_settings_and_notifications.sql")
  : ""
for (const col of ["notify_on_dispatch", "notify_on_check_call_missed", "notify_on_driver_late", "notify_on_route_deviation"]) {
  if (migration238.includes(col) && numberFormats.includes(col)) pass(`migration 238 + settings: ${col}`)
  else if (!migration238) fail("migration 238 file missing")
  else fail(`migration 238 / settings mismatch: ${col}`)
}

if (vercelJson.includes("/api/cron/scan-dispatch-events")) {
  pass("vercel.json schedules dispatch event scan")
} else {
  warn("vercel.json missing scan-dispatch-events cron entry")
}

if (loadsSrc.includes("dispatched") || loadsSrc.includes("isFirstDispatchTransition")) {
  pass("loads.ts sends dispatched notifications on first schedule/in_transit")
} else {
  fail("loads.ts missing notify_on_dispatch wiring")
}

if (exists("lib/company-notification-channels.ts") && read("app/actions/notifications.ts").includes("companyAllowsEmail")) {
  pass("sendNotification respects company notification_channels")
} else {
  fail("sendNotification missing notification_channels gating")
}

if (loadDispatchValidation.includes("emergency_contact_required") || loadDispatchValidation.includes("emergency_contact_phone")) {
  pass("dispatch readiness enforces driver emergency contact when required")
} else {
  fail("getDispatchReadinessError missing emergency contact gate")
}

if (exists("lib/notify-load-event.ts") && read("app/actions/dispatches.ts").includes("notifyLoadOperationsEvent")) {
  pass("quickAssignLoad sends dispatched notifications")
} else if (exists("app/actions/load-notify.ts") && read("app/actions/dispatches.ts").includes("notifyLoadOperationsEvent")) {
  pass("quickAssignLoad sends dispatched notifications")
} else {
  fail("quickAssignLoad missing dispatched notification wiring")
}

if (read("app/actions/check-calls.ts").includes("milestone")) {
  pass("check calls support milestone scheduling when enabled")
} else {
  fail("scheduleCheckCallsForLoad missing milestone support")
}

if (read("lib/eld/geofence-detector.ts").includes("geofence_enabled")) {
  pass("geofence cron respects company geofence_enabled setting")
} else {
  fail("geofence-detector missing geofence_enabled gate")
}

if (exists("app/actions/check-call-customer-notify.ts") && read("app/actions/check-calls.ts").includes("notifyCustomerBrokerForCheckCallEvent")) {
  pass("check-call customer/broker email notifications wired on completion")
} else {
  fail("check-call customer/broker notifications not wired")
}

if (read("app/actions/loads.ts").includes("notifyCustomerBrokerForCheckCallEvent") && read("app/actions/loads.ts").includes("trip_start")) {
  pass("trip_start customer/broker email on in_transit transition")
} else {
  fail("trip_start customer/broker notification missing from loads.ts")
}

if (read("app/actions/notifications.ts").includes("companyAllowsPush") && read("app/actions/notifications.ts").includes("sendPushToUser")) {
  pass("sendNotification routes push channel when enabled")
} else {
  fail("sendNotification missing push channel routing")
}

if (exists("lib/operations-auto-assign-settings.ts") && read("lib/load-auto-assign.ts").includes("resolveEffectiveAutoAssignSettings")) {
  pass("auto-assign merges dispatch driver assignment settings")
} else {
  fail("dispatch driver assignment settings not merged into auto-assign")
}

if (exists("app/actions/route-auto-optimize.ts") && read("app/actions/route-stops.ts").includes("maybeAutoOptimizeRouteAfterStopChange")) {
  pass("auto_optimize_routes triggers after route stop changes")
} else {
  fail("auto_optimize_routes not wired to route stop creation")
}

if (read("lib/eld/geofence-detector.ts").includes("geofence_radius")) {
  pass("geofence detector uses company geofence_radius default")
} else {
  fail("geofence_radius not applied in geofence detector")
}

if (read("app/api/eld/mobile/locations/route.ts").includes("track_driver_location") && read("app/api/eld/mobile/locations/route.ts").includes("location_update_interval")) {
  pass("mobile location API respects tracking settings")
} else {
  fail("mobile location API missing tracking interval enforcement")
}

console.log("\n10. TypeScript config (build health)")
const tsconfig = JSON.parse(read("tsconfig.json"))
const staleIncludes = (tsconfig.include || []).filter((p) => String(p).includes(".cache/truckmates-next"))
if (staleIncludes.length > 0) warn(`tsconfig.json includes stale cache paths: ${staleIncludes.join(", ")}`)
else pass("tsconfig.json has no stale external .next cache paths")

console.log(`\n=== Summary: ${failures} failure(s), ${warnings} warning(s) ===\n`)
process.exit(failures > 0 ? 1 : 0)
