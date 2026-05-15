"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  testELDConnection,
  createELDDeviceFromWizard,
  discoverVehiclesForDeviceAction,
  saveVehicleMappings,
  completeELDSetup,
  getEldConnectionCount,
  type EldWizardProvider,
  type DiscoveredVehicleWithSuggestion,
} from "@/app/actions/eld-wizard"
import { getTrucks, createTruck } from "@/app/actions/trucks"
import { CheckCircle2, Loader2, PlugZap, ChevronLeft, ChevronRight } from "lucide-react"

const STORAGE_KEY = "tm:eld-wizard-v1"

type WizardState = {
  step: number
  provider: EldWizardProvider | null
  credentials: Record<string, string>
  deviceLabel: string
  eldDeviceId: string | null
  testOk: boolean
  vehicles: DiscoveredVehicleWithSuggestion[]
  mappings: Record<string, string | null>
}

const defaultState = (): WizardState => ({
  step: 1,
  provider: null,
  credentials: {},
  deviceLabel: "",
  eldDeviceId: null,
  testOk: false,
  vehicles: [],
  mappings: {},
})

const PROVIDERS: Array<{ id: EldWizardProvider; name: string; tagline: string }> = [
  { id: "samsara", name: "Samsara", tagline: "Cloud fleet platform with open API" },
  { id: "motive", name: "Motive", tagline: "Formerly KeepTruckin — ELD + fleet API" },
  { id: "geotab", name: "Geotab", tagline: "MyGeotab / GO devices via JSON-RPC" },
]

function confidenceBadge(c: string) {
  if (c === "high") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Auto-matched (VIN/plate)</Badge>
  if (c === "medium") return <Badge className="bg-amber-500/15 text-amber-800 border-amber-500/30">Likely match</Badge>
  if (c === "low") return <Badge className="bg-orange-500/15 text-orange-800 border-orange-500/30">Possible match</Badge>
  return <Badge variant="outline">Select truck</Badge>
}

export function EldConnectWizard() {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(defaultState)
  const [loading, setLoading] = useState(false)
  const [trucks, setTrucks] = useState<Array<{ id: string; truck_number?: string | null }>>([])
  const [limitInfo, setLimitInfo] = useState<{ count: number; limit: number } | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setState({ ...defaultState(), ...JSON.parse(raw) })
    } catch {
      // ignore
    }
    void getEldConnectionCount().then((r) => {
      if (r.data) setLimitInfo({ count: r.data.count, limit: r.data.limit })
    })
    void getTrucks().then((r) => {
      if (r.data) {
        setTrucks(
          (r.data as unknown[]).map((t) => {
            const o = t as { id?: string; truck_number?: string }
            return { id: String(o.id), truck_number: o.truck_number }
          }),
        )
      }
    })
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore
    }
  }, [state])

  const setStep = (step: number) => setState((s) => ({ ...s, step }))

  const providerName = useMemo(
    () => PROVIDERS.find((p) => p.id === state.provider)?.name ?? "Provider",
    [state.provider],
  )

  const runTest = async () => {
    if (!state.provider) return
    setLoading(true)
    const r = await testELDConnection({ provider: state.provider, credentials: state.credentials })
    setLoading(false)
    if (r.error || !r.data?.success) {
      toast.error(r.error || "Connection failed")
      setState((s) => ({ ...s, testOk: false }))
    } else {
      toast.success("Connection verified!")
      setState((s) => ({ ...s, testOk: true }))
    }
  }

  const saveDevice = async () => {
    if (!state.provider || !state.testOk) return
    setLoading(true)
    const r = await createELDDeviceFromWizard({
      provider: state.provider,
      credentials: state.credentials,
      deviceLabel: state.deviceLabel || `${providerName} connection`,
    })
    setLoading(false)
    if (r.error || !r.data) {
      toast.error(r.error || "Failed to save connection")
      return
    }
    setState((s) => ({ ...s, eldDeviceId: r.data!.eld_device_id }))
    toast.success("Connection saved")
    setStep(4)
    void loadVehicles(r.data.eld_device_id)
  }

  const loadVehicles = async (deviceId: string) => {
    setLoading(true)
    const r = await discoverVehiclesForDeviceAction({ eldDeviceId: deviceId })
    setLoading(false)
    if (r.error) {
      toast.error(r.error)
      return
    }
    const vehicles = r.data ?? []
    const mappings: Record<string, string | null> = {}
    for (const v of vehicles) {
      mappings[v.provider_vehicle_id] = v.suggested_truck_id
    }
    setState((s) => ({ ...s, vehicles, mappings }))
  }

  const finishMappings = async (skip: boolean) => {
    if (!state.eldDeviceId) return
    setLoading(true)
    if (!skip && state.vehicles.length > 0) {
      const r = await saveVehicleMappings({
        eldDeviceId: state.eldDeviceId,
        mappings: state.vehicles.map((v) => ({
          provider_vehicle_id: v.provider_vehicle_id,
          provider_vehicle_name: v.name,
          provider_vin: v.vin,
          provider_license_plate: v.license_plate,
          truck_id: state.mappings[v.provider_vehicle_id] ?? null,
          auto_matched: Boolean(v.suggested_truck_id && state.mappings[v.provider_vehicle_id] === v.suggested_truck_id),
          match_confidence: v.confidence,
        })),
      })
      if (r.error) {
        setLoading(false)
        toast.error(r.error)
        return
      }
    }
    const done = await completeELDSetup({ eldDeviceId: state.eldDeviceId })
    setLoading(false)
    if (done.error) {
      toast.error(done.error)
      return
    }
    sessionStorage.removeItem(STORAGE_KEY)
    setStep(5)
  }

  const addTruck = async (vehicle: DiscoveredVehicleWithSuggestion) => {
    const num = vehicle.name.replace(/[^\dA-Za-z-]/g, "").slice(0, 20) || vehicle.provider_vehicle_id.slice(0, 8)
    const r = await createTruck({
      truck_number: num,
      vin: vehicle.vin || undefined,
      license_plate: vehicle.license_plate || undefined,
      status: "active",
    })
    if (r.error || !r.data) {
      toast.error(r.error || "Could not create truck")
      return
    }
    const id = (r.data as { id: string }).id
    setTrucks((t) => [...t, { id, truck_number: num }])
    setState((s) => ({
      ...s,
      mappings: { ...s.mappings, [vehicle.provider_vehicle_id]: id },
    }))
    toast.success("Truck created")
  }

  const atLimit = Boolean(
    limitInfo && limitInfo.limit > 0 && limitInfo.count >= limitInfo.limit,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PlugZap className="h-7 w-7 text-primary" />
            Connect your ELD
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Step {state.step} of 5 — no new hardware required
          </p>
        </div>
        <Link href="/dashboard/eld/devices">
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </Link>
      </div>

      {atLimit && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          You&apos;ve reached your ELD connection limit ({limitInfo!.count}/{limitInfo!.limit}).
          Upgrade or remove an existing connection in{" "}
          <Link href="/dashboard/eld/devices" className="text-primary underline">
            ELD Devices
          </Link>
          .
        </Card>
      )}

      {state.step === 1 && (
        <Card className="p-6 space-y-4">
          <p className="text-muted-foreground">
            TruckMates connects to your existing ELD. Choose your telematics provider.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`rounded-lg border p-4 text-left transition hover:border-primary ${
                  state.provider === p.id ? "border-primary bg-primary/5" : "border-border"
                }`}
                onClick={() => setState((s) => ({ ...s, provider: p.id }))}
              >
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.tagline}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Don&apos;t see your provider? Contact support.</p>
          <Button disabled={!state.provider || atLimit} onClick={() => setStep(2)}>
            Continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {state.step === 2 && state.provider && (
        <Card className="p-6 space-y-4 prose prose-sm dark:prose-invert max-w-none">
          <h2 className="text-lg font-semibold">Get your {providerName} API credentials</h2>
          {state.provider === "samsara" && (
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Log into Samsara at cloud.samsara.com</li>
              <li>Click your name (top right) → Settings</li>
              <li>In the left sidebar, click API Tokens</li>
              <li>Click + Generate API Token</li>
              <li>Name it &quot;TruckMates Integration&quot;</li>
              <li>Select scopes: Read Vehicles, Read Statistics, Read Safety Events, Read Diagnostics</li>
              <li>Click Generate — copy the token immediately (starts with samsara_api_). You only see it once.</li>
            </ol>
          )}
          {state.provider === "motive" && (
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Log into Motive at gomotive.com (or keeptruckin.com for older accounts)</li>
              <li>Navigate to Admin → API Manager</li>
              <li>Generate Token / New API Key</li>
              <li>Enable: Vehicles Read, Driver Read, Performance Events Read, Diagnostic Events Read</li>
              <li>Copy the key (32+ characters)</li>
            </ol>
          )}
          {state.provider === "geotab" && (
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Use your MyGeotab email as username</li>
              <li>Use your MyGeotab password</li>
              <li>Database name: from the URL, e.g. my.geotab.com/g560 → database is g560</li>
              <li>Server URL: typically https://my.geotab.com unless you use a custom host</li>
            </ol>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => setStep(3)}>I have my credentials</Button>
          </div>
        </Card>
      )}

      {state.step === 3 && state.provider && (
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Connection label</Label>
            <Input
              value={state.deviceLabel}
              onChange={(e) => setState((s) => ({ ...s, deviceLabel: e.target.value }))}
              placeholder={`${providerName} fleet`}
            />
          </div>
          {state.provider === "samsara" && (
            <div className="space-y-2">
              <Label>API token</Label>
              <Input
                type="password"
                autoComplete="off"
                value={state.credentials.apiKey || ""}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    credentials: { ...s.credentials, apiKey: e.target.value },
                    testOk: false,
                  }))
                }
              />
            </div>
          )}
          {state.provider === "motive" && (
            <>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  value={state.credentials.apiKey || ""}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      credentials: { ...s.credentials, apiKey: e.target.value },
                      testOk: false,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>API secret (if required)</Label>
                <Input
                  type="password"
                  value={state.credentials.apiSecret || ""}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      credentials: { ...s.credentials, apiSecret: e.target.value },
                      testOk: false,
                    }))
                  }
                />
              </div>
            </>
          )}
          {state.provider === "geotab" && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={state.credentials.username || ""}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        credentials: { ...s.credentials, username: e.target.value },
                        testOk: false,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={state.credentials.password || ""}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        credentials: { ...s.credentials, password: e.target.value },
                        testOk: false,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Database</Label>
                  <Input
                    placeholder="g560"
                    value={state.credentials.database || ""}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        credentials: { ...s.credentials, database: e.target.value },
                        testOk: false,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Server URL</Label>
                  <Input
                    placeholder="https://my.geotab.com"
                    value={state.credentials.serverUrl || "https://my.geotab.com"}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        credentials: { ...s.credentials, serverUrl: e.target.value },
                        testOk: false,
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button variant="secondary" onClick={() => void runTest()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test connection"}
            </Button>
            {state.testOk && (
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Verified
              </span>
            )}
            <Button disabled={!state.testOk || loading || atLimit} onClick={() => void saveDevice()}>
              Save &amp; continue
            </Button>
          </div>
        </Card>
      )}

      {state.step === 4 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Map vehicles</h2>
          {loading && <p className="text-sm text-muted-foreground">Discovering vehicles from {providerName}…</p>}
          {!loading && state.vehicles.length === 0 && (
            <p className="text-sm text-muted-foreground">No vehicles returned. You can finish and map later.</p>
          )}
          <div className="max-h-[420px] overflow-y-auto space-y-3">
            {state.vehicles.map((v) => (
              <div key={v.provider_vehicle_id} className="flex flex-wrap items-center gap-2 border-b pb-3">
                <div className="min-w-[140px] flex-1">
                  <p className="font-medium text-sm">{v.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{v.vin || "No VIN"}</p>
                </div>
                {confidenceBadge(state.mappings[v.provider_vehicle_id] ? v.confidence : "none")}
                <Select
                  value={state.mappings[v.provider_vehicle_id] || "__none__"}
                  onValueChange={(val) =>
                    setState((s) => ({
                      ...s,
                      mappings: {
                        ...s.mappings,
                        [v.provider_vehicle_id]: val === "__none__" ? null : val,
                      },
                    }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Truck" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not mapped —</SelectItem>
                    {trucks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.truck_number || t.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => void addTruck(v)}>
                  + New truck
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button variant="ghost" onClick={() => void finishMappings(true)} disabled={loading}>
              Skip mapping
            </Button>
            <Button onClick={() => void finishMappings(false)} disabled={loading}>
              Save mappings &amp; finish
            </Button>
          </div>
        </Card>
      )}

      {state.step === 5 && (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-bold">{providerName} connected!</h2>
          <p className="text-muted-foreground">
            Data will start syncing within about 30 minutes. Mapped{" "}
            {Object.values(state.mappings).filter(Boolean).length} vehicle(s).
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            <Link href="/dashboard/eld/geofences" className="text-primary underline">
              Configure geofences →
            </Link>
            <Link href="/dashboard/eld/scorecards" className="text-primary underline">
              Driver scorecards →
            </Link>
            <Link href="/dashboard/settings/alerts" className="text-primary underline">
              Notifications →
            </Link>
          </div>
          <Button onClick={() => router.push("/dashboard/eld")}>Done</Button>
        </Card>
      )}
    </div>
  )
}
