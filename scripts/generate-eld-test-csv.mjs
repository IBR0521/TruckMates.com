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

function csvEscape(v) {
  const value = String(v ?? "")
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function utcDate(d) {
  return d.toISOString().split("T")[0]
}

function hhmm(d) {
  return d.toISOString().slice(11, 16)
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

  const userEmailArg = process.argv.find((a) => a.startsWith("--email="))
  const userEmail = (userEmailArg ? userEmailArg.split("=")[1] : "ibr20117o@gmail.com").toLowerCase()

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, company_id, full_name, email")
    .eq("email", userEmail)
    .maybeSingle()

  if (userErr || !userRow?.company_id) {
    throw new Error(`Cannot resolve company/user for email "${userEmail}": ${userErr?.message || "not found"}`)
  }

  const companyId = userRow.company_id
  const now = new Date()
  const today = utcDate(now)
  const seedSuffix = String(Date.now()).slice(-6)
  const testDriverEmail = `eld.test.${seedSuffix}@example.com`
  const vin = "1HGBH41JXMN109186"

  // 1) Inject test driver
  const { data: driver, error: driverErr } = await supabase
    .from("drivers")
    .insert({
      company_id: companyId,
      name: "Test Driver FMCSA",
      email: testDriverEmail,
      phone: "+15555550199",
      status: "active",
      license_number: `CDL-${seedSuffix}`,
    })
    .select("id, name, email")
    .single()

  if (driverErr || !driver?.id) {
    throw new Error(`Failed to create test driver: ${driverErr?.message || "unknown"}`)
  }

  // 2) Inject test truck (realistic VIN)
  const { data: truck, error: truckErr } = await supabase
    .from("trucks")
    .insert({
      company_id: companyId,
      truck_number: `ELD-${seedSuffix}`,
      make: "Freightliner",
      model: "Cascadia",
      year: 2022,
      vin,
      status: "in_use",
      mileage: 125430,
      fuel_level: 72,
    })
    .select("id, truck_number, vin, mileage")
    .single()

  if (truckErr || !truck?.id) {
    throw new Error(`Failed to create test truck: ${truckErr?.message || "unknown"}`)
  }

  // 3) Inject ELD device
  const { data: device, error: deviceErr } = await supabase
    .from("eld_devices")
    .insert({
      company_id: companyId,
      truck_id: truck.id,
      device_name: "FMCSA Test ELD",
      device_serial_number: `ELD-SN-${seedSuffix}`,
      provider: "other",
      status: "active",
      installation_date: today,
    })
    .select("id, device_serial_number, provider")
    .single()

  if (deviceErr || !device?.id) {
    throw new Error(`Failed to create ELD device: ${deviceErr?.message || "unknown"}`)
  }

  // 4) Inject duty-status events with odometer/engine hours progression
  const dayStart = new Date(`${today}T00:00:00.000Z`)
  const events = [
    { type: "off_duty", startMin: 0, endMin: 360, miles: 0, eng: 0.0 },
    { type: "on_duty", startMin: 360, endMin: 390, miles: 0, eng: 0.4 },
    { type: "driving", startMin: 390, endMin: 630, miles: 185, eng: 4.1 },
    { type: "on_duty", startMin: 630, endMin: 660, miles: 0, eng: 0.5 },
    { type: "off_duty", startMin: 660, endMin: 1440, miles: 0, eng: 0.0 },
  ]

  let odo = 125430
  let engineHoursBase = 5421.3
  const logRows = []
  for (const e of events) {
    const start = new Date(dayStart.getTime() + e.startMin * 60 * 1000)
    const end = new Date(dayStart.getTime() + e.endMin * 60 * 1000)
    const nextOdo = odo + e.miles
    const nextEngineHours = Number((engineHoursBase + e.eng).toFixed(1))
    logRows.push({
      company_id: companyId,
      eld_device_id: device.id,
      driver_id: driver.id,
      truck_id: truck.id,
      log_date: today,
      log_type: e.type,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: e.endMin - e.startMin,
      odometer_start: odo,
      odometer_end: nextOdo,
      miles_driven: e.miles,
      engine_hours: nextEngineHours,
      location_start: { lat: 30.2672, lng: -97.7431, address: "Austin, TX" },
      location_end: { lat: 29.7604, lng: -95.3698, address: "Houston, TX" },
      raw_data: { source: "fmcsa_test_generator" },
    })
    odo = nextOdo
    engineHoursBase = nextEngineHours
  }

  const { error: logsErr } = await supabase.from("eld_logs").insert(logRows)
  if (logsErr) {
    throw new Error(`Failed to insert ELD logs: ${logsErr.message}`)
  }

  const { data: insertedLogs, error: fetchErr } = await supabase
    .from("eld_logs")
    .select("log_type, start_time, end_time, duration_minutes, odometer_start, odometer_end, miles_driven, engine_hours")
    .eq("company_id", companyId)
    .eq("driver_id", driver.id)
    .eq("eld_device_id", device.id)
    .eq("log_date", today)
    .order("start_time", { ascending: true })

  if (fetchErr) {
    throw new Error(`Failed to fetch generated logs: ${fetchErr.message}`)
  }

  // 5) Build FMCSA-style CSV blocks
  const rows = []
  rows.push(["Block", "Field", "Value"])
  rows.push(["USER_INFO", "DriverName", driver.name])
  rows.push(["USER_INFO", "DriverEmail", driver.email])
  rows.push(["USER_INFO", "LogDateUTC", today])
  rows.push(["USER_INFO", "ELDProvider", device.provider])
  rows.push(["VEHICLE_INFO", "TruckNumber", truck.truck_number])
  rows.push(["VEHICLE_INFO", "VIN", truck.vin])
  rows.push(["VEHICLE_INFO", "DeviceSerial", device.device_serial_number])
  rows.push(["POWER_UNIT_INFO", "StartingOdometer", logRows[0].odometer_start])
  rows.push(["POWER_UNIT_INFO", "EndingOdometer", logRows[logRows.length - 1].odometer_end])
  rows.push(["POWER_UNIT_INFO", "StartingEngineHours", 5421.3])
  rows.push(["POWER_UNIT_INFO", "EndingEngineHours", engineHoursBase])

  for (const [i, l] of (insertedLogs || []).entries()) {
    const start = new Date(l.start_time)
    rows.push(["EVENT_DATA", "EventIndex", i + 1])
    rows.push(["EVENT_DATA", "DutyStatus", l.log_type])
    rows.push(["EVENT_DATA", "StartTimeUTC", `${utcDate(start)} ${hhmm(start)}`])
    rows.push(["EVENT_DATA", "DurationMinutes", l.duration_minutes ?? ""])
    rows.push(["EVENT_DATA", "OdometerStart", l.odometer_start ?? ""])
    rows.push(["EVENT_DATA", "OdometerEnd", l.odometer_end ?? ""])
    rows.push(["EVENT_DATA", "MilesDriven", l.miles_driven ?? ""])
    rows.push(["EVENT_DATA", "EngineHours", l.engine_hours ?? ""])
  }

  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n"
  const outDir = path.join(cwd, "exports")
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `eld-fmcsa-test-${today}-${seedSuffix}.csv`)
  await fs.writeFile(outPath, csv, "utf8")

  console.log("FMCSA test CSV generated successfully.")
  console.log(`Output: ${outPath}`)
  console.log(`Company ID: ${companyId}`)
  console.log(`Driver: ${driver.name} (${driver.email})`)
  console.log(`Truck VIN: ${truck.vin}`)
}

main().catch((err) => {
  console.error("Failed to generate ELD test CSV.")
  console.error(err?.message || err)
  process.exit(1)
})

