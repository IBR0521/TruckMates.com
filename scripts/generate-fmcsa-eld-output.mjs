import fs from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

function parseDotEnv(text) {
  const env = {}
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function safeCsvField(v) {
  return String(v ?? "").replace(/,/g, ";").replace(/[\r\n]+/g, ";")
}

function toHex2(n) {
  return (n & 0xff).toString(16).toUpperCase().padStart(2, "0")
}

function toHex4(n) {
  return (n & 0xffff).toString(16).toUpperCase().padStart(4, "0")
}

function rol8(v) {
  const n = v & 0xff
  return ((n << 1) | (n >> 7)) & 0xff
}

function lineDataCheckFromRawLine(rawCsvLine) {
  let checksum = 0
  for (let i = 0; i < rawCsvLine.length; i += 1) {
    checksum = (checksum + rawCsvLine.charCodeAt(i)) & 0xff
  }
  let rotated = checksum
  rotated = rol8(rotated)
  rotated = rol8(rotated)
  rotated = rol8(rotated)
  const lineCheck = rotated ^ 0x96
  return lineCheck & 0xff
}

function buildOutputLine(fields) {
  const base = fields.map(safeCsvField).join(",")
  const lineCheck = lineDataCheckFromRawLine(base)
  return { line: `${base},${toHex2(lineCheck)}`, lineCheck }
}

function mapDutyStatusToEventCode(logType) {
  switch (logType) {
    case "off_duty":
      return "1"
    case "sleeper_berth":
      return "2"
    case "driving":
      return "3"
    case "on_duty":
      return "4"
    default:
      return "0"
  }
}

function fmtDate(dt) {
  const d = new Date(dt)
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const yy = String(d.getUTCFullYear()).slice(-2)
  return `${mm}${dd}${yy}`
}

function fmtTime(dt) {
  const d = new Date(dt)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh}${mm}00`
}

function sumDigits(s) {
  return String(s || "")
    .split("")
    .filter((c) => c >= "0" && c <= "9")
    .reduce((a, b) => a + Number(b), 0)
}

function normalizeLastName5(lastName) {
  const n = (lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  return (n + "_____").slice(0, 5)
}

function buildFmcsaFilename({ lastName, licenseNumber, createdAt = new Date() }) {
  const ln5 = normalizeLastName5(lastName)
  const digits = String(licenseNumber || "").replace(/\D/g, "")
  const last2 = (digits.slice(-2) || "00").padStart(2, "0")
  const sum2 = String(sumDigits(digits) % 100).padStart(2, "0")
  const mmddyy = fmtDate(createdAt)
  return `${ln5}${last2}${sum2}${mmddyy}-000000000.csv`
}

async function main() {
  const cwd = process.cwd()
  const envPath = path.join(cwd, ".env.local")
  const envText = await fs.readFile(envPath, "utf8")
  const env = parseDotEnv(envText)

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const emailArg = process.argv.find((a) => a.startsWith("--email="))
  const requestedEmail = (emailArg ? emailArg.split("=")[1] : "eld.test.508196@example.com").toLowerCase()

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: driver, error: driverErr } = await supabase
    .from("drivers")
    .select("id, company_id, name, email, license_number, license_state")
    .eq("email", requestedEmail)
    .maybeSingle()
  if (driverErr || !driver?.id || !driver.company_id) {
    throw new Error(
      `Driver not found for "${requestedEmail}". Run eld:generate-test-csv first or pass a valid --email=...`
    )
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name, usdot_number")
    .eq("id", driver.company_id)
    .maybeSingle()

  const now = new Date()
  const start = new Date(now)
  start.setUTCDate(now.getUTCDate() - 7)
  start.setUTCHours(0, 0, 0, 0)

  const { data: logs, error: logsErr } = await supabase
    .from("eld_logs")
    .select("id, log_type, start_time, end_time, odometer_end, engine_hours, truck_id, location_end, raw_data")
    .eq("company_id", driver.company_id)
    .eq("driver_id", driver.id)
    .gte("start_time", start.toISOString())
    .order("start_time", { ascending: false })

  if (logsErr) throw new Error(`Failed to load ELD logs: ${logsErr.message}`)
  if (!logs || logs.length === 0) throw new Error("No ELD logs found for last 8 days for this driver.")

  const truckIds = [...new Set(logs.map((l) => l.truck_id).filter(Boolean))]
  const { data: trucks, error: trucksErr } = await supabase
    .from("trucks")
    .select("id, truck_number, vin")
    .in("id", truckIds.length ? truckIds : ["00000000-0000-0000-0000-000000000000"])

  if (trucksErr) throw new Error(`Failed to load trucks: ${trucksErr.message}`)
  const truckById = new Map((trucks || []).map((t) => [t.id, t]))
  const cmvOrderById = new Map()
  truckIds.forEach((id, idx) => cmvOrderById.set(id, idx + 1))

  const [firstName, ...restName] = String(driver.name || "Test Driver").trim().split(/\s+/)
  const lastName = restName.length ? restName.join(" ") : "Driver"
  const licenseNumber = driver.license_number || "D0000000"
  const licenseState = (driver.license_state || "TX").toUpperCase()

  const lines = []
  const lineChecks = []
  const push = (fields) => {
    const out = buildOutputLine(fields)
    lines.push(out.line)
    lineChecks.push(out.lineCheck)
  }

  // Header segment (FMCSA parser expects this exact segment title token)
  push(["ELD File:"])
  push([
    lastName,
    firstName || "Test",
    (driver.email || "driver").split("@")[0],
    licenseState,
    licenseNumber,
    "", // co-driver last name
    "", // co-driver first name
    "", // exempt driver config
    "", // hours rule set
    "", // carrier name
    company?.name || "TruckMates Carrier",
    "", // USDOT in header can vary by implementation
    company?.usdot_number || "",
    "TruckMates ELD",
    "TMELD01",
    "AUTH-TM-TEST",
    "FMCSA upload qualification test file",
  ])

  // User list
  push(["User List:"])
  push(["1", "D", lastName, firstName || "Test"])

  // CMV list
  push(["CMV List:"])
  for (const truckId of truckIds) {
    const truck = truckById.get(truckId) || {}
    push([String(cmvOrderById.get(truckId)), truck.vin || "", truck.truck_number || ""])
  }

  // ELD event list
  push(["ELD Event List:"])
  logs.forEach((log, idx) => {
    const t = truckById.get(log.truck_id) || {}
    const loc = log.location_end || {}
    const lat = typeof loc.lat === "number" ? loc.lat.toFixed(4) : ""
    const lon = typeof loc.lng === "number" ? loc.lng.toFixed(4) : ""
    push([
      String(idx + 1), // event seq id
      "1", // event record status
      "1", // event record origin
      "1", // event type: duty status change
      mapDutyStatusToEventCode(log.log_type), // event code
      fmtDate(log.start_time),
      fmtTime(log.start_time),
      log.odometer_end ?? "",
      log.engine_hours ?? "",
      lat,
      lon,
      String(cmvOrderById.get(log.truck_id) || 1),
      "1", // user order number
      "", // malfunction indicator
      "", // data diagnostic indicator
      "", // event data check value (system generated normally)
    ])
  })

  // Annotations/comments section
  push(["ELD Event Annotations or Comments:"])
  push(["", "", "Generated for FMCSA qualification testing", fmtDate(now), fmtTime(now), "", "", fmtDate(now), fmtTime(now), "", "1"])

  // Certifications section
  push(["Driver's Certification/Recertification Actions:"])
  push(["1", "1", fmtDate(now), fmtTime(now), "1", "Certified by test driver"])

  // Malfunction/diagnostics section
  push(["Malfunctions and Data Diagnostic Events:"])

  // Login/logout section
  push(["ELD Login/Logout Report:"])
  push(["1", "1", "5", "1", fmtDate(now), fmtTime(now), logs[0]?.odometer_end ?? "", logs[0]?.engine_hours ?? ""])

  // Engine power-up/down section
  push(["CMV Engine Power-Up and Shut Down Activity:"])

  // Unidentified profile section
  push(["Unidentified Driver Profile Records:"])

  // File check value (section 4.8.2.1.11)
  const checksum16 = lineChecks.reduce((sum, n) => (sum + n) & 0xffff, 0)
  const hi = (checksum16 >> 8) & 0xff
  const lo = checksum16 & 0xff
  const rol3 = (b) => rol8(rol8(rol8(b)))
  const rotated16 = ((rol3(hi) << 8) | rol3(lo)) & 0xffff
  const fileDataCheck = (rotated16 ^ 0x969c) & 0xffff
  push(["End of File:", toHex4(fileDataCheck)])

  const filename = buildFmcsaFilename({ lastName, licenseNumber, createdAt: now })
  const outDir = path.join(cwd, "exports")
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, filename)
  // FMCSA Appendix A specifies comma-delimited with carriage-return line separation.
  await fs.writeFile(outPath, `${lines.join("\r\n")}\r\n`, "utf8")

  console.log("FMCSA transfer-style file generated.")
  console.log(`Driver email: ${requestedEmail}`)
  console.log(`Output: ${outPath}`)
}

main().catch((err) => {
  console.error("Failed to generate FMCSA transfer-style file.")
  console.error(err?.message || err)
  process.exit(1)
})

