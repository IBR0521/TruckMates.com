"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { addDays, endOfDay, format, startOfDay } from "date-fns"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  assignLoadToTruckFromBoard,
  getLoadsForPlanningBoard,
  type DispatchPlanningLoadRow,
} from "@/app/actions/dispatches"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { ChevronLeft, ChevronRight, GripVertical, MapPin, RefreshCw, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

const DAY_COL_PX = 112
const SIDEBAR_LOAD_PREFIX = "sidebar-load:"
const TRUCK_PREFIX = "truck:"

type TruckRow = {
  id: string
  truck_number?: string | null
  make?: string | null
  model?: string | null
  status?: string | null
  current_driver_id?: string | null
}

type DriverRow = { id: string; name?: string | null }

function draggableSidebarId(loadId: string) {
  return `${SIDEBAR_LOAD_PREFIX}${loadId}`
}

function droppableTruckId(truckId: string) {
  return `${TRUCK_PREFIX}${truckId}`
}

function parseSidebarLoadId(activeId: string | number | null): string | null {
  const s = String(activeId ?? "")
  if (!s.startsWith(SIDEBAR_LOAD_PREFIX)) return null
  return s.slice(SIDEBAR_LOAD_PREFIX.length) || null
}

function parseTruckDropId(overId: string | number | null): string | null {
  const s = String(overId ?? "")
  if (!s.startsWith(TRUCK_PREFIX)) return null
  return s.slice(TRUCK_PREFIX.length) || null
}

function getPlanningWindow(row: DispatchPlanningLoadRow) {
  const start = row.load_date ? new Date(row.load_date) : new Date(row.created_at)
  let end = row.estimated_delivery ? new Date(row.estimated_delivery) : addDays(start, 1)
  if (end.getTime() <= start.getTime()) end = addDays(start, 1)
  return { start, end }
}

function assignLanes(jobs: { id: string; start: number; end: number }[]) {
  const sorted = [...jobs].sort((a, b) => a.start - b.start || a.end - b.end)
  const laneEnds: number[] = []
  const laneById = new Map<string, number>()
  for (const job of sorted) {
    let lane = 0
    while (lane < laneEnds.length && job.start < laneEnds[lane]) lane++
    if (lane === laneEnds.length) {
      laneEnds.push(job.end)
    } else {
      laneEnds[lane] = Math.max(laneEnds[lane], job.end)
    }
    laneById.set(job.id, lane)
  }
  return { laneById, laneCount: Math.max(1, laneEnds.length) }
}

function barStyle(
  row: DispatchPlanningLoadRow,
  viewStart: Date,
  viewEnd: Date,
  lane: number,
  laneHeight: number,
) {
  const { start, end } = getPlanningWindow(row)
  const vs = viewStart.getTime()
  const ve = viewEnd.getTime()
  const total = Math.max(1, ve - vs)
  const leftPct = Math.max(0, Math.min(100, ((start.getTime() - vs) / total) * 100))
  const rawWidth = ((end.getTime() - start.getTime()) / total) * 100
  const widthPct = Math.min(100 - leftPct, Math.max(0.35, rawWidth))
  const top = 6 + lane * laneHeight
  return { leftPct, widthPct, top }
}

function statusBarClass(status: string | null | undefined) {
  const s = String(status || "").toLowerCase()
  if (s === "in_transit" || s === "in_progress") return "bg-emerald-600/90"
  if (s === "scheduled" || s === "confirmed") return "bg-sky-600/90"
  if (s === "pending") return "bg-amber-600/90"
  if (s === "draft") return "bg-slate-600/80"
  return "bg-primary/80"
}

function SidebarLoadCard({
  load,
  disabled,
}: {
  load: { id: string; shipment_number?: string | null; origin?: string | null; destination?: string | null; status?: string | null }
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableSidebarId(load.id),
    disabled: disabled || !load.id,
    data: { loadId: load.id },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div ref={setNodeRef} style={style} className={cn("touch-none", isDragging && "opacity-40")}>
      <Card className="border-border p-3 shadow-sm">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...listeners}
            {...attributes}
            aria-label="Drag to assign load"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {load.shipment_number || "Load"}
              </span>
              {load.status ? (
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                  {String(load.status).replace(/_/g, " ")}
                </Badge>
              ) : null}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {(load.origin || "—") + " → " + (load.destination || "—")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function TruckTimelineRow({
  truck,
  loads,
  viewStart,
  viewEnd,
  days,
  driverLabel,
  onBarClick,
  droppable = true,
}: {
  truck: TruckRow
  loads: DispatchPlanningLoadRow[]
  viewStart: Date
  viewEnd: Date
  days: Date[]
  driverLabel: string | null
  onBarClick: (loadId: string) => void
  droppable?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableTruckId(truck.id),
    data: { truckId: truck.id },
    disabled: !droppable,
  })

  const jobs = useMemo(() => {
    return loads.map((row) => {
      const { start, end } = getPlanningWindow(row)
      return { id: row.id, start: start.getTime(), end: end.getTime(), row }
    })
  }, [loads])

  const { laneById, laneCount } = useMemo(() => assignLanes(jobs), [jobs])
  const laneHeight = 26
  const rowBodyHeight = Math.max(48, 12 + laneCount * laneHeight)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex border-b border-border transition-colors",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30",
      )}
    >
      <div className="flex w-44 shrink-0 flex-col justify-center border-r border-border bg-muted/20 px-3 py-2 md:w-52">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-semibold text-foreground">{truck.truck_number || truck.id.slice(0, 8)}</span>
        </div>
        {driverLabel ? <p className="mt-1 truncate text-xs text-muted-foreground">{driverLabel}</p> : null}
        <p className="mt-0.5 text-[10px] uppercase text-muted-foreground">{truck.status || "—"}</p>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden" style={{ minHeight: rowBodyHeight }}>
        <div className="absolute inset-0 flex pointer-events-none">
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="shrink-0 border-l border-border/60 bg-background/40"
              style={{ width: DAY_COL_PX }}
            />
          ))}
        </div>
        <div className="relative h-full w-full">
          {loads.map((row) => {
            const lane = laneById.get(row.id) ?? 0
            const { leftPct, widthPct, top } = barStyle(row, viewStart, viewEnd, lane, laneHeight)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onBarClick(row.id)}
                className={cn(
                  "absolute z-[1] flex max-h-[22px] cursor-pointer flex-col overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white shadow-sm ring-1 ring-black/10 transition hover:brightness-110",
                  statusBarClass(row.status),
                )}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top,
                  minWidth: 32,
                }}
                title={`${row.shipment_number || row.id}\n${row.origin || ""} → ${row.destination || ""}`}
              >
                <span className="truncate leading-tight">{row.shipment_number || "Load"}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function DispatchPlanningBoard({
  trucks,
  sidebarLoads,
  drivers,
  companyId,
  terminalId,
  onRefresh,
  onLoadClick,
  beforeAssignTruck,
}: {
  trucks: TruckRow[]
  sidebarLoads: Array<{
    id: string
    shipment_number?: string | null
    origin?: string | null
    destination?: string | null
    status?: string | null
  }>
  drivers: DriverRow[]
  companyId: string | null
  terminalId?: string
  onRefresh: () => void | Promise<void>
  onLoadClick?: (loadId: string) => void
  beforeAssignTruck?: (truckId: string) => void | Promise<void>
}) {
  const [viewAnchor, setViewAnchor] = useState(() => startOfDay(new Date()))
  const viewStart = viewAnchor
  const viewEnd = endOfDay(addDays(viewStart, 6))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(viewStart, i)), [viewStart])

  const [assignedLoads, setAssignedLoads] = useState<DispatchPlanningLoadRow[]>([])
  const [loadingBoard, setLoadingBoard] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const driverNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of drivers) {
      if (d.id) m.set(d.id, d.name || d.id)
    }
    return m
  }, [drivers])

  const fetchAssigned = useCallback(async () => {
    setLoadingBoard(true)
    try {
      const res = await getLoadsForPlanningBoard({
        windowStartIso: viewStart.toISOString(),
        windowEndIso: viewEnd.toISOString(),
        terminalId,
      })
      if (res.error) {
        toast.error(res.error)
        setAssignedLoads([])
        return
      }
      setAssignedLoads(res.data || [])
    } finally {
      setLoadingBoard(false)
    }
  }, [viewStart, viewEnd, terminalId])

  useEffect(() => {
    void fetchAssigned()
  }, [fetchAssigned])

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchAssigned()
    }, 45000)
    return () => window.clearInterval(id)
  }, [fetchAssigned])

  useRealtimeSubscription<DispatchPlanningLoadRow>(
    "loads",
    {
      filter: companyId ? `company_id=eq.${companyId}` : undefined,
      event: "*",
      enabled: !!companyId,
      onInsert: () => {
        void fetchAssigned()
      },
      onUpdate: () => {
        void fetchAssigned()
      },
      onDelete: () => {
        void fetchAssigned()
      },
    },
  )

  const truckIds = useMemo(() => new Set(trucks.map((t) => t.id)), [trucks])

  const loadsByTruck = useMemo(() => {
    const map = new Map<string, DispatchPlanningLoadRow[]>()
    const orphans: DispatchPlanningLoadRow[] = []
    for (const row of assignedLoads) {
      const tid = row.truck_id ? String(row.truck_id) : ""
      if (tid && truckIds.has(tid)) {
        const list = map.get(tid) || []
        list.push(row)
        map.set(tid, list)
      } else if (tid) {
        orphans.push(row)
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => getPlanningWindow(a).start.getTime() - getPlanningWindow(b).start.getTime())
    }
    return { map, orphans }
  }, [assignedLoads, truckIds])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const activeSidebarLoad = useMemo(() => {
    if (!activeDragId) return null
    const loadId = parseSidebarLoadId(activeDragId)
    if (!loadId) return null
    return sidebarLoads.find((l) => l.id === loadId) || null
  }, [activeDragId, sidebarLoads])

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id))
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null)
    const loadId = parseSidebarLoadId(e.active.id)
    const truckId = e.over ? parseTruckDropId(e.over.id) : null
    if (!loadId || !truckId) return

    setAssigning(true)
    try {
      if (beforeAssignTruck) await beforeAssignTruck(truckId)
      const result = await assignLoadToTruckFromBoard(loadId, truckId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Load assigned to truck")
      await Promise.resolve(onRefresh())
      await fetchAssigned()
    } catch {
      toast.error("Assignment failed")
    } finally {
      setAssigning(false)
    }
  }

  function navigateWeek(dir: "prev" | "next") {
    setViewAnchor((prev) => addDays(prev, dir === "next" ? 7 : -7))
  }

  const timelineMinWidth = days.length * DAY_COL_PX

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-[420px] flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 lg:w-72 xl:w-80">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Unassigned loads</h2>
            <Badge variant="secondary">{sidebarLoads.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Drag a card onto a truck row to assign. Driver is filled from the truck&apos;s current driver when set.
          </p>
          <ScrollArea className="h-[min(52vh,520px)] pr-3">
            <div className="flex flex-col gap-2 pb-2">
              {sidebarLoads.length === 0 ? (
                <Card className="border-border p-4 text-center text-sm text-muted-foreground">No loads in this queue.</Card>
              ) : (
                sidebarLoads.map((load) => (
                  <SidebarLoadCard key={load.id} load={load} disabled={assigning} />
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        <Card className="min-w-0 flex-1 border-border p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Planning board</h2>
              <p className="text-xs text-muted-foreground">
                {format(viewStart, "MMM d")} – {format(viewEnd, "MMM d, yyyy")} · Trucks on rows, time across columns
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingBoard || assigning}
                onClick={() => {
                  void fetchAssigned()
                  void Promise.resolve(onRefresh())
                }}
              >
                <RefreshCw className={cn("mr-1 h-4 w-4", loadingBoard && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {loadingBoard && assignedLoads.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading board…</div>
          ) : trucks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-40" />
              <p>No trucks loaded. Add trucks in Fleet, or widen filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <div style={{ minWidth: 176 + timelineMinWidth }}>
                <div className="flex border-b border-border bg-muted/30">
                  <div className="flex w-44 shrink-0 items-center border-r border-border px-3 py-2 text-xs font-semibold uppercase text-muted-foreground md:w-52">
                    Truck
                  </div>
                  <div className="flex">
                    {days.map((d) => (
                      <div
                        key={d.toISOString()}
                        className="flex shrink-0 flex-col items-center justify-center border-l border-border py-2 text-center"
                        style={{ width: DAY_COL_PX }}
                      >
                        <span className="text-[10px] text-muted-foreground">{format(d, "EEE")}</span>
                        <span className="text-xs font-semibold text-foreground">{format(d, "MMM d")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {trucks.map((truck) => {
                  const list = loadsByTruck.map.get(truck.id) || []
                  const driverLabel = truck.current_driver_id
                    ? driverNameById.get(String(truck.current_driver_id)) || null
                    : null
                  return (
                    <TruckTimelineRow
                      key={truck.id}
                      truck={truck}
                      loads={list}
                      viewStart={viewStart}
                      viewEnd={viewEnd}
                      days={days}
                      driverLabel={driverLabel}
                      onBarClick={(id) => onLoadClick?.(id)}
                    />
                  )
                })}

                {loadsByTruck.orphans.length > 0 ? (
                  <TruckTimelineRow
                    truck={{
                      id: "__orphan__",
                      truck_number: "Other / unmapped truck",
                      status: "review",
                    }}
                    loads={loadsByTruck.orphans}
                    viewStart={viewStart}
                    viewEnd={viewEnd}
                    days={days}
                    driverLabel={null}
                    droppable={false}
                    onBarClick={(id) => onLoadClick?.(id)}
                  />
                ) : null}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Overlapping bars on the same row usually mean overlapping schedules for that truck—verify dates or reassign.
          </p>
        </Card>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSidebarLoad ? (
          <Card className="pointer-events-none w-72 border-primary/40 p-3 shadow-lg">
            <p className="text-sm font-semibold">{activeSidebarLoad.shipment_number || "Load"}</p>
            <p className="text-xs text-muted-foreground">
              {(activeSidebarLoad.origin || "—") + " → " + (activeSidebarLoad.destination || "—")}
            </p>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
