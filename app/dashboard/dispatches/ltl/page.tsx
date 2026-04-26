"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  attachShipmentToMovement,
  createShipment,
  createTruckMovement,
  getMovementShipments,
  getShipments,
  getTruckMovements,
} from "@/app/actions/ltl-shipments"

export default function LtlDispatchPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [selectedMovement, setSelectedMovement] = useState<string>("")
  const [movementShipments, setMovementShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [newShipment, setNewShipment] = useState({ shipment_number: "", shipper_name: "", consignee_name: "" })
  const [newMovement, setNewMovement] = useState({
    movement_number: "",
    movement_date: "",
    max_weight_lbs: "45000",
    max_cube_ft: "3800",
  })

  async function loadData() {
    setLoading(true)
    const [s, m] = await Promise.all([getShipments(), getTruckMovements()])
    if (s.data) setShipments(s.data)
    if (m.data) setMovements(m.data)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (!selectedMovement) return
    void (async () => {
      const result = await getMovementShipments(selectedMovement)
      if (result.data) setMovementShipments(result.data)
    })()
  }, [selectedMovement])

  const selectedMovementObj = useMemo(
    () => movements.find((m) => m.id === selectedMovement) || null,
    [movements, selectedMovement],
  )

  const usage = useMemo(() => {
    const usedWeight = movementShipments.reduce(
      (sum, row) => sum + Number(row?.shipments?.total_weight_lbs || 0),
      0,
    )
    const usedCube = movementShipments.reduce((sum, row) => sum + Number(row?.shipments?.total_cube_ft || 0), 0)
    return { usedWeight, usedCube }
  }, [movementShipments])

  async function handleCreateShipment() {
    const result = await createShipment(newShipment)
    if (result.error) return toast.error(result.error)
    toast.success("Shipment created")
    setNewShipment({ shipment_number: "", shipper_name: "", consignee_name: "" })
    await loadData()
  }

  async function handleCreateMovement() {
    const result = await createTruckMovement({
      movement_number: newMovement.movement_number,
      movement_date: newMovement.movement_date || undefined,
      max_weight_lbs: Number(newMovement.max_weight_lbs || 45000),
      max_cube_ft: Number(newMovement.max_cube_ft || 3800),
    })
    if (result.error) return toast.error(result.error)
    toast.success("Truck movement created")
    setNewMovement({ movement_number: "", movement_date: "", max_weight_lbs: "45000", max_cube_ft: "3800" })
    await loadData()
  }

  async function handleAttach(shipmentId: string) {
    if (!selectedMovement) return toast.error("Select a truck movement first")
    const result = await attachShipmentToMovement({ movement_id: selectedMovement, shipment_id: shipmentId })
    if (result.error) return toast.error(result.error)
    toast.success("Shipment attached")
    const refresh = await getMovementShipments(selectedMovement)
    if (refresh.data) setMovementShipments(refresh.data)
  }

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">LTL Consolidation</h1>
      <p className="text-sm text-muted-foreground">
        Create truck movements, then attach multiple shipments while respecting weight/cube capacity.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">New Shipment</h2>
          <div>
            <Label>Shipment Number</Label>
            <Input value={newShipment.shipment_number} onChange={(e) => setNewShipment((p) => ({ ...p, shipment_number: e.target.value }))} />
          </div>
          <div>
            <Label>Shipper</Label>
            <Input value={newShipment.shipper_name} onChange={(e) => setNewShipment((p) => ({ ...p, shipper_name: e.target.value }))} />
          </div>
          <div>
            <Label>Consignee</Label>
            <Input value={newShipment.consignee_name} onChange={(e) => setNewShipment((p) => ({ ...p, consignee_name: e.target.value }))} />
          </div>
          <Button onClick={handleCreateShipment}>Create Shipment</Button>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">New Truck Movement</h2>
          <div>
            <Label>Movement Number</Label>
            <Input value={newMovement.movement_number} onChange={(e) => setNewMovement((p) => ({ ...p, movement_number: e.target.value }))} />
          </div>
          <div>
            <Label>Movement Date</Label>
            <Input type="date" value={newMovement.movement_date} onChange={(e) => setNewMovement((p) => ({ ...p, movement_date: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Max Weight (lbs)</Label>
              <Input value={newMovement.max_weight_lbs} onChange={(e) => setNewMovement((p) => ({ ...p, max_weight_lbs: e.target.value }))} />
            </div>
            <div>
              <Label>Max Cube (ft3)</Label>
              <Input value={newMovement.max_cube_ft} onChange={(e) => setNewMovement((p) => ({ ...p, max_cube_ft: e.target.value }))} />
            </div>
          </div>
          <Button onClick={handleCreateMovement}>Create Movement</Button>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Select Movement</h2>
        <select
          className="w-full rounded border bg-background px-3 py-2 text-sm"
          value={selectedMovement}
          onChange={(e) => setSelectedMovement(e.target.value)}
        >
          <option value="">Choose a movement</option>
          {movements.map((m) => (
            <option key={m.id} value={m.id}>
              {m.movement_number} ({m.status})
            </option>
          ))}
        </select>
        {selectedMovementObj ? (
          <p className="text-xs text-muted-foreground">
            Capacity used: {usage.usedWeight.toFixed(0)} / {Number(selectedMovementObj.max_weight_lbs || 0).toFixed(0)} lbs,{" "}
            {usage.usedCube.toFixed(0)} / {Number(selectedMovementObj.max_cube_ft || 0).toFixed(0)} ft3
          </p>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Available Shipments</h2>
          <div className="space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {shipments.map((s) => (
              <div key={s.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <p className="text-sm font-medium">{s.shipment_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.shipper_name || "Shipper"} → {s.consignee_name || "Consignee"} | {Number(s.total_weight_lbs || 0).toFixed(0)} lbs
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleAttach(s.id)}>
                  Attach
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Movement Shipments</h2>
          <div className="space-y-2">
            {movementShipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attached shipments yet.</p>
            ) : (
              movementShipments.map((row) => (
                <div key={row.id} className="border rounded p-2">
                  <p className="text-sm font-medium">{row.shipments?.shipment_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.shipments?.shipper_name || "Shipper"} → {row.shipments?.consignee_name || "Consignee"} |{" "}
                    {Number(row.shipments?.total_weight_lbs || 0).toFixed(0)} lbs |{" "}
                    {Number(row.shipments?.total_cube_ft || 0).toFixed(0)} ft3
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
