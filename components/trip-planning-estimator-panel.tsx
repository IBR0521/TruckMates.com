"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DetailSection } from "@/components/dashboard/detail-page-layout"
import { Loader2, Calculator, AlertTriangle, Info } from "lucide-react"
import {
  getTripPlanningEstimate,
  saveTripPlanningEstimateOnLoad,
  type TripPlanningEstimate,
} from "@/app/actions/promiles"
import { stripStaleEnvKeyWarnings } from "@/lib/promiles/strip-trip-env-warnings"
import { toast } from "sonner"

export function isPlaceholderDestination(d?: string | null) {
  if (!d?.trim()) return true
  const t = d.trim().toLowerCase()
  return (
    t.includes("multiple location") ||
    t.includes("multi-stop") ||
    t === "multiple" ||
    t === "tbd" ||
    t === "various"
  )
}

export type TripPlanningEstimatorPanelProps = {
  /** When set, result is saved on the load after calculate */
  loadId?: string
  origin?: string | null
  destination?: string | null
  initialEstimate?: TripPlanningEstimate | null
  truckGrossWeightLbs?: number | null
  onSaved?: () => void | Promise<void>
  /** Avoid duplicate HTML ids if multiple panels on one page */
  idPrefix?: string
  /**
   * When `destination` is a placeholder (e.g. "Multiple Locations"), pre-fill routing from
   * the last delivery point — geocoding needs one origin → one destination leg.
   */
  suggestedRoutingDestination?: string | null
  /** When set (e.g. from load delivery points), route origin → stop 1 → … → last for full mileage. */
  deliveryStopAddresses?: string[]
}

export function TripPlanningEstimatorPanel({
  loadId,
  origin,
  destination,
  initialEstimate,
  truckGrossWeightLbs,
  onSaved,
  idPrefix = "tpe",
  suggestedRoutingDestination,
  deliveryStopAddresses,
}: TripPlanningEstimatorPanelProps) {
  const pid = (s: string) => `${idPrefix}-${s}`

  const [routingOrigin, setRoutingOrigin] = useState(() => origin?.trim() ?? "")
  const [routingDestination, setRoutingDestination] = useState(() => {
    const d = destination?.trim() ?? ""
    if (!isPlaceholderDestination(d)) return d
    return suggestedRoutingDestination?.trim() ?? ""
  })
  const [mpg, setMpg] = useState("6.5")
  const [grossLbs, setGrossLbs] = useState(
    truckGrossWeightLbs && truckGrossWeightLbs > 0 ? String(truckGrossWeightLbs) : "80000",
  )
  const [axles, setAxles] = useState("5")
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<TripPlanningEstimate | null>(() =>
    stripStaleEnvKeyWarnings(initialEstimate ?? null),
  )

  useEffect(() => {
    if (initialEstimate) setEstimate(stripStaleEnvKeyWarnings(initialEstimate))
  }, [initialEstimate])

  useEffect(() => {
    if (truckGrossWeightLbs && truckGrossWeightLbs > 0) {
      setGrossLbs(String(truckGrossWeightLbs))
    }
  }, [truckGrossWeightLbs])

  useEffect(() => {
    if (!loadId) return
    setRoutingOrigin(origin?.trim() ?? "")
    const d = destination?.trim() ?? ""
    if (!isPlaceholderDestination(d)) {
      setRoutingDestination(d)
    } else if (suggestedRoutingDestination?.trim()) {
      setRoutingDestination((prev) =>
        prev.trim() === "" ? suggestedRoutingDestination.trim() : prev,
      )
    }
  }, [loadId, origin, destination, suggestedRoutingDestination])

  /** Effective ordered stops for API: last element follows the Destination field (override final drop). */
  const stopsForApi = useMemo(() => {
    if (!deliveryStopAddresses?.length) return undefined
    const last =
      routingDestination.trim() || deliveryStopAddresses[deliveryStopAddresses.length - 1]
    const chain = [...deliveryStopAddresses.slice(0, -1), last].map((s) => s.trim()).filter(Boolean)
    return chain.length > 0 ? chain : undefined
  }, [deliveryStopAddresses, routingDestination])

  const useFullChain = Boolean(stopsForApi && stopsForApi.length > 0)
  const canRun = useFullChain
    ? Boolean(routingOrigin.trim())
    : Boolean(routingOrigin.trim() && routingDestination.trim())

  const handleRun = async () => {
    if (!canRun) {
      toast.error(
        loadId
          ? useFullChain
            ? "Enter routing origin."
            : "Enter routing origin and a real destination address (not “Multiple Locations”)."
          : "Enter origin and destination.",
      )
      return
    }
    const mpgNum = parseFloat(mpg)
    if (!Number.isFinite(mpgNum) || mpgNum <= 0) {
      toast.error("Enter a valid MPG")
      return
    }
    const gross = parseInt(grossLbs, 10)
    const axleCount = parseInt(axles, 10)
    setLoading(true)
    try {
      const result = await getTripPlanningEstimate({
        origin: routingOrigin.trim(),
        destination:
          (stopsForApi && stopsForApi.length > 0
            ? stopsForApi[stopsForApi.length - 1]
            : routingDestination
          ).trim(),
        mpg: mpgNum,
        truck: {
          grossWeightLbs: Number.isFinite(gross) && gross > 0 ? gross : undefined,
          axleCount: Number.isFinite(axleCount) && axleCount > 0 ? axleCount : undefined,
        },
      })
      if (result.error || !result.data) {
        toast.error(result.error || "Trip planning failed")
        return
      }
      // Fresh run: show all warnings from server (keys missing, HERE down, etc.)
      setEstimate(result.data)

      if (loadId) {
        const save = await saveTripPlanningEstimateOnLoad(loadId, result.data)
        if (save.error) {
          toast.error(
            `Computed estimate but could not save: ${save.error}. Run supabase/promiles_load_estimate.sql if the column is missing.`,
          )
          return
        }
        toast.success("Trip planning estimate saved on this load")
        await onSaved?.()
      } else {
        toast.success("Estimate ready (not saved — open a load to attach it to a shipment)")
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Trip planning failed")
    } finally {
      setLoading(false)
    }
  }

  const warnMissingOrigin = Boolean(loadId && !origin?.trim())
  const warnPlaceholderNoStops = Boolean(
    loadId &&
      isPlaceholderDestination(destination) &&
      !suggestedRoutingDestination?.trim() &&
      !(deliveryStopAddresses && deliveryStopAddresses.length > 0),
  )
  const showFullChainInfo = Boolean(loadId && (deliveryStopAddresses?.length ?? 0) >= 2)
  const showLegacyMultiStopInfo = Boolean(
    loadId &&
      isPlaceholderDestination(destination) &&
      suggestedRoutingDestination?.trim() &&
      (deliveryStopAddresses?.length ?? 0) < 2,
  )

  return (
    <DetailSection
      title="Trip planning (ProMiles-style)"
      icon={<Calculator className="w-5 h-5" />}
      description={
        loadId
          ? "Saved on this load when you calculate. Uses HERE truck routing (or Google fallback), state miles, EIA diesel, and HERE toll data when routing succeeds."
          : "Truck route, state miles, fuel & toll estimates. Nothing is saved until you run this from a load."
      }
    >
      <div className="space-y-6">
        {showFullChainInfo && (
          <div className="flex gap-2 rounded-md border border-sky-500/35 bg-sky-500/10 p-3 text-sm">
            <Info className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
            <p className="text-muted-foreground">
              Multi-stop load: mileage and drive time follow the full truck route{" "}
              <strong className="text-foreground">pickup → all {deliveryStopAddresses?.length} delivery stops</strong> in
              stop order (HERE truck or Google fallback). The destination field is your{" "}
              <strong className="text-foreground">final drop</strong> — edit it if the last stop should differ.
            </p>
          </div>
        )}
        {showLegacyMultiStopInfo && (
          <div className="flex gap-2 rounded-md border border-sky-500/35 bg-sky-500/10 p-3 text-sm">
            <Info className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
            <p className="text-muted-foreground">
              Multi-stop load: we default the destination to your <strong className="text-foreground">last delivery stop</strong>{" "}
              (by stop #). Add delivery points on the load for a full multi-stop chain, or change the destination field for
              a single leg.
            </p>
          </div>
        )}
        {(warnPlaceholderNoStops || warnMissingOrigin) && (
          <div className="flex gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            <div className="text-muted-foreground">
              {warnPlaceholderNoStops && (
                <p>
                  This load’s destination is <strong className="text-foreground">not a single address</strong> (e.g.
                  &quot;Multiple Locations&quot;) and we couldn’t read delivery stops yet. Enter a{" "}
                  <strong className="text-foreground">real city, ST</strong> or full address below, or add delivery
                  points on the load.
                </p>
              )}
              {warnMissingOrigin && (
                <p className={warnPlaceholderNoStops ? "mt-2" : ""}>
                  Add an origin address below (or on the load) to run trip planning.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={pid("origin")}>Origin</Label>
            <Input
              id={pid("origin")}
              value={routingOrigin}
              onChange={(e) => setRoutingOrigin(e.target.value)}
              placeholder="City, ST or full address"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={pid("dest")}>Destination</Label>
            <Input
              id={pid("dest")}
              value={routingDestination}
              onChange={(e) => setRoutingDestination(e.target.value)}
              placeholder="City, ST or full address"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor={pid("mpg")}>Assumed MPG</Label>
            <Input
              id={pid("mpg")}
              type="number"
              step="0.1"
              min="1"
              value={mpg}
              onChange={(e) => setMpg(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={pid("gvw")}>GVW (lbs)</Label>
            <Input
              id={pid("gvw")}
              type="number"
              min="1"
              value={grossLbs}
              onChange={(e) => setGrossLbs(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={pid("axles")}>Axle count</Label>
            <Input
              id={pid("axles")}
              type="number"
              min="2"
              max="8"
              value={axles}
              onChange={(e) => setAxles(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={loading || !canRun}
              onClick={() => void handleRun()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Calculating…
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  {loadId ? "Calculate & save" : "Calculate"}
                </>
              )}
            </Button>
          </div>
        </div>

        {estimate && (
          <div className="space-y-4 rounded-lg border border-border/60 bg-secondary/10 p-4">
            <div className="flex flex-wrap gap-3 text-sm">
              {estimate.multi_stop && estimate.multi_stop.delivery_stop_count >= 2 && (
                <span className="text-muted-foreground">
                  Full chain: {estimate.multi_stop.delivery_stop_count} delivery stops
                </span>
              )}
              <span className="font-medium text-foreground">
                Routing:{" "}
                <span className="text-primary">
                  {estimate.routing_provider === "here" ? "HERE truck" : "Google (fallback)"}
                </span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                Distance: <strong>{estimate.distance_miles.toLocaleString()} mi</strong>
              </span>
              {estimate.duration_seconds != null && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span>
                    ~{Math.round(estimate.duration_seconds / 3600)}h{" "}
                    {Math.round((estimate.duration_seconds % 3600) / 60)}m
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Computed {new Date(estimate.computed_at).toLocaleString()}
            </p>

            {estimate.state_miles.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Miles by state</p>
                <div className="overflow-x-auto rounded border border-border/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30 text-left">
                        <th className="px-3 py-2">State</th>
                        <th className="px-3 py-2">Miles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.state_miles.map((row) => (
                        <tr key={row.state_code} className="border-b border-border/40">
                          <td className="px-3 py-1.5 font-mono">{row.state_code}</td>
                          <td className="px-3 py-1.5">{row.miles.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-background/50 p-3 border border-border/40">
                <p className="text-muted-foreground text-xs mb-1">Fuel (planning)</p>
                <p className="text-foreground">
                  ~{estimate.fuel.estimated_gallons.toLocaleString()} gal
                  {estimate.fuel.estimated_cost_usd != null && (
                    <> · ${estimate.fuel.estimated_cost_usd.toFixed(2)}</>
                  )}
                </p>
                {estimate.fuel.diesel_note && (
                  <p className="text-xs text-muted-foreground mt-1">{estimate.fuel.diesel_note}</p>
                )}
              </div>
              <div className="rounded-md bg-background/50 p-3 border border-border/40">
                <p className="text-muted-foreground text-xs mb-1">Tolls (estimate)</p>
                <p className="text-foreground">
                  {estimate.tolls.estimated_usd != null
                    ? `$${estimate.tolls.estimated_usd.toFixed(2)}`
                    : "—"}
                </p>
                {estimate.tolls.note && (
                  <p className="text-xs text-muted-foreground mt-1">{estimate.tolls.note}</p>
                )}
              </div>
            </div>

            {estimate.warnings.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  {estimate.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </DetailSection>
  )
}
