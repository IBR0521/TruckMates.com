"use client"

import { useEffect, useState } from "react"
import { errorMessage } from "@/lib/error-message"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getTrucks } from "@/app/actions/trucks"
import { getDrivers } from "@/app/actions/drivers"
import { createTripSheet, listTripSheets } from "@/app/actions/ifta-trip-sheet"
import type { TripSheetStateMileRow, TripSheetFuelRow } from "@/app/actions/ifta-trip-sheet"

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]

export default function IFTATripSheetPage() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/dashboard/ifta/trip-sheet") {
      router.replace("/dashboard/ifta?tab=trip-sheet")
    }
  }, [pathname, router])

  const [trucks, setTrucks] = useState<Array<{ id: string; truck_number: string }>>([])
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([])
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [tripDate, setTripDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [driverId, setDriverId] = useState<string>("")
  const [truckId, setTruckId] = useState<string>("")
  const [odoStart, setOdoStart] = useState("")
  const [odoEnd, setOdoEnd] = useState("")
  const [originState, setOriginState] = useState("")
  const [destState, setDestState] = useState("")
  const [notes, setNotes] = useState("")
  const [stateRows, setStateRows] = useState<TripSheetStateMileRow[]>([{ state_code: "", miles_driven: 0 }])
  const [fuelRows, setFuelRows] = useState<TripSheetFuelRow[]>([
    { state_code: "", gallons: 0, price_per_gallon: 0 },
  ])

  useEffect(() => {
    ;(async () => {
      const [t, d, list] = await Promise.all([
        getTrucks(),
        getDrivers({ limit: 100 }),
        listTripSheets(),
      ])
      if (t.data) setTrucks(t.data.map((x: any) => ({ id: x.id, truck_number: x.truck_number })))
      if (d.data) setDrivers(d.data.map((x: any) => ({ id: x.id, name: x.name })))
      if (list.data) setRecent(list.data.slice(0, 15))
    })()
  }, [])

  const addStateRow = () => setStateRows([...stateRows, { state_code: "", miles_driven: 0 }])
  const removeStateRow = (i: number) => setStateRows(stateRows.filter((_, j) => j !== i))

  const addFuelRow = () =>
    setFuelRows([...fuelRows, { state_code: "", gallons: 0, price_per_gallon: 0 }])
  const removeFuelRow = (i: number) => setFuelRows(fuelRows.filter((_, j) => j !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!truckId) {
      toast.error("Select a truck")
      return
    }
    const sm = stateRows
      .filter((r) => r.state_code.trim() && r.miles_driven > 0)
      .map((r) => ({ ...r, state_code: r.state_code.toUpperCase().slice(0, 2) }))
    if (sm.length === 0) {
      toast.error("Add at least one state with miles")
      return
    }
    const fr = fuelRows
      .filter((r) => r.state_code.trim() && r.gallons > 0 && r.price_per_gallon >= 0)
      .map((r) => ({
        ...r,
        state_code: r.state_code.toUpperCase().slice(0, 2),
        total_amount: Math.round(r.gallons * r.price_per_gallon * 100) / 100,
      }))

    setLoading(true)
    try {
      const result = await createTripSheet({
        trip_date: tripDate,
        driver_id: driverId || null,
        truck_id: truckId,
        odometer_start: odoStart ? parseFloat(odoStart) : null,
        odometer_end: odoEnd ? parseFloat(odoEnd) : null,
        origin_state: originState || null,
        destination_state: destState || null,
        notes: notes || null,
        state_miles: sm,
        fuel_purchases: fr,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Trip sheet saved — included in IFTA quarterly reports for this period.")
        setStateRows([{ state_code: "", miles_driven: 0 }])
        setFuelRows([{ state_code: "", gallons: 0, price_per_gallon: 0 }])
        setNotes("")
        const list = await listTripSheets()
        if (list.data) setRecent(list.data.slice(0, 15))
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <Link href="/dashboard/ifta">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to IFTA
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">IFTA trip sheet</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manual miles and fuel by state (no ELD required). Data feeds quarterly IFTA generation with GPS data when
              present.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 border-border space-y-4">
            <h2 className="font-semibold text-lg">Trip header</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Trip date</Label>
                <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="mt-1" required />
              </div>
              <div>
                <Label>Truck</Label>
                <Select value={truckId} onValueChange={setTruckId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select truck" />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.truck_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Driver (optional)</Label>
                <Select value={driverId || "__none__"} onValueChange={(v) => setDriverId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Start odometer</Label>
                  <Input
                    type="number"
                    value={odoStart}
                    onChange={(e) => setOdoStart(e.target.value)}
                    className="mt-1"
                    placeholder="mi"
                  />
                </div>
                <div>
                  <Label>End odometer</Label>
                  <Input
                    type="number"
                    value={odoEnd}
                    onChange={(e) => setOdoEnd(e.target.value)}
                    className="mt-1"
                    placeholder="mi"
                  />
                </div>
              </div>
              <div>
                <Label>Origin state</Label>
                <Select value={originState || "__none__"} onValueChange={(v) => setOriginState(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">—</SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destination state</Label>
                <Select value={destState || "__none__"} onValueChange={(v) => setDestState(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">—</SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="Optional" />
            </div>
          </Card>

          <Card className="p-6 border-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Miles by state</h2>
              <Button type="button" variant="outline" size="sm" onClick={addStateRow}>
                <Plus className="w-4 h-4 mr-1" /> Row
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2">State</th>
                    <th className="text-left py-2">Miles driven</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {stateRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-2">
                        <Select
                          value={row.state_code || "__pick__"}
                          onValueChange={(v) => {
                            const next = [...stateRows]
                            next[i] = { ...next[i], state_code: v === "__pick__" ? "" : v }
                            setStateRows(next)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            <SelectItem value="__pick__">—</SelectItem>
                            {US_STATES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={row.miles_driven || ""}
                          onChange={(e) => {
                            const next = [...stateRows]
                            next[i] = { ...next[i], miles_driven: parseFloat(e.target.value) || 0 }
                            setStateRows(next)
                          }}
                        />
                      </td>
                      <td>
                        {stateRows.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeStateRow(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 border-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Fuel purchases</h2>
              <Button type="button" variant="outline" size="sm" onClick={addFuelRow}>
                <Plus className="w-4 h-4 mr-1" /> Row
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2">State</th>
                    <th className="text-left py-2">Gallons</th>
                    <th className="text-left py-2">$/gal</th>
                    <th className="text-left py-2">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {fuelRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-2">
                        <Select
                          value={row.state_code || "__pick__"}
                          onValueChange={(v) => {
                            const next = [...fuelRows]
                            next[i] = { ...next[i], state_code: v === "__pick__" ? "" : v }
                            setFuelRows(next)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            <SelectItem value="__pick__">—</SelectItem>
                            {US_STATES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={row.gallons || ""}
                          onChange={(e) => {
                            const next = [...fuelRows]
                            next[i] = { ...next[i], gallons: parseFloat(e.target.value) || 0 }
                            setFuelRows(next)
                          }}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.001}
                          value={row.price_per_gallon || ""}
                          onChange={(e) => {
                            const next = [...fuelRows]
                            next[i] = { ...next[i], price_per_gallon: parseFloat(e.target.value) || 0 }
                            setFuelRows(next)
                          }}
                        />
                      </td>
                      <td className="py-2 text-muted-foreground">
                        ${(row.gallons * row.price_per_gallon).toFixed(2)}
                      </td>
                      <td>
                        {fuelRows.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeFuelRow(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Button type="submit" className="w-full md:w-auto" disabled={loading}>
            {loading ? "Saving…" : "Save trip sheet"}
          </Button>
        </form>

        {recent.length > 0 && (
          <Card className="p-6 border-border">
            <h2 className="font-semibold text-lg mb-4">Recent trip sheets</h2>
            <ul className="space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex justify-between border-b border-border/40 pb-2">
                  <span>
                    {r.trip_date} — Truck {r.trucks?.truck_number || "?"}
                    {r.drivers?.name ? ` — ${r.drivers.name}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
