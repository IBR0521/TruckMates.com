"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Building2, Truck, Users, Package, Route } from "lucide-react"
import { getTerminalMetrics } from "@/app/actions/terminals"
import { toast } from "sonner"

export default function TerminalsReportPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    terminals: Array<{ id: string; name: string; timezone: string; trucks: number; drivers: number; loads: number; in_transit: number }>
    totals: { trucks: number; drivers: number; loads: number; in_transit: number }
  } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await getTerminalMetrics()
      if (res.error) toast.error(res.error)
      if (res.data) setData(res.data)
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <Card className="p-5">
        <h2 className="text-xl font-semibold">Consolidated Company View</h2>
        <p className="text-sm text-muted-foreground mt-1">All-terminal totals across trucks, drivers, and loads.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Metric icon={Truck} label="Trucks" value={data?.totals.trucks ?? 0} />
          <Metric icon={Users} label="Drivers" value={data?.totals.drivers ?? 0} />
          <Metric icon={Package} label="Loads" value={data?.totals.loads ?? 0} />
          <Metric icon={Route} label="In Transit" value={data?.totals.in_transit ?? 0} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data?.terminals || []).map((terminal) => (
          <Card key={terminal.id} className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">{terminal.name}</h3>
              </div>
              <span className="text-xs text-muted-foreground">{terminal.timezone}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div>Trucks: <strong>{terminal.trucks}</strong></div>
              <div>Drivers: <strong>{terminal.drivers}</strong></div>
              <div>Loads: <strong>{terminal.loads}</strong></div>
              <div>In Transit: <strong>{terminal.in_transit}</strong></div>
            </div>
          </Card>
        ))}
      </div>
      {!loading && (!data?.terminals || data.terminals.length === 0) && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No terminals created yet. Add terminals to start branch-level reporting.
        </Card>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}
