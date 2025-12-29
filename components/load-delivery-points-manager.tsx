"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Package, Clock, FileText, ChevronRight } from "lucide-react"

interface DeliveryPoint {
  id?: string
  delivery_number: number
  location_name: string
  location_id?: string
  address: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  delivery_type?: string
  priority?: string
  weight_kg?: number
  weight_lbs?: number
  pieces?: number
  pallets?: number
  boxes?: number
  carts?: number
  volume_cubic_meters?: number
  delivery_instructions?: string
  special_handling?: string
  requires_liftgate?: boolean
  requires_inside_delivery?: boolean
  requires_appointment?: boolean
  appointment_time?: string
  scheduled_delivery_date?: string
  scheduled_delivery_time?: string
  time_window_start?: string
  time_window_end?: string
  reference_number?: string
  notes?: string
}

interface LoadDeliveryPointsManagerProps {
  deliveryPoints: DeliveryPoint[]
  onDeliveryPointsChange: (points: DeliveryPoint[]) => void
}

export function LoadDeliveryPointsManager({ deliveryPoints, onDeliveryPointsChange }: LoadDeliveryPointsManagerProps) {
  const [expandedPoint, setExpandedPoint] = useState<number | null>(null)

  const addDeliveryPoint = () => {
    const newPoint: DeliveryPoint = {
      delivery_number: deliveryPoints.length + 1,
      location_name: "",
      address: "",
      delivery_type: "delivery",
      pieces: 0,
      pallets: 0,
      boxes: 0,
      carts: 0,
      requires_liftgate: false,
      requires_inside_delivery: false,
      requires_appointment: false,
    }
    onDeliveryPointsChange([...deliveryPoints, newPoint])
    setExpandedPoint(deliveryPoints.length)
  }

  const removeDeliveryPoint = (index: number) => {
    const newPoints = deliveryPoints.filter((_, i) => i !== index).map((point, i) => ({
      ...point,
      delivery_number: i + 1,
    }))
    onDeliveryPointsChange(newPoints)
    if (expandedPoint === index) {
      setExpandedPoint(null)
    } else if (expandedPoint !== null && expandedPoint > index) {
      setExpandedPoint(expandedPoint - 1)
    }
  }

  const updateDeliveryPoint = (index: number, field: keyof DeliveryPoint, value: any) => {
    const newPoints = [...deliveryPoints]
    newPoints[index] = { ...newPoints[index], [field]: value }
    onDeliveryPointsChange(newPoints)
  }

  const moveDeliveryPoint = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === deliveryPoints.length - 1)
    ) {
      return
    }

    const newPoints = [...deliveryPoints]
    const newIndex = direction === "up" ? index - 1 : index + 1
    ;[newPoints[index], newPoints[newIndex]] = [newPoints[newIndex], newPoints[index]]

    // Update delivery numbers
    newPoints.forEach((point, i) => {
      point.delivery_number = i + 1
    })

    onDeliveryPointsChange(newPoints)
    if (expandedPoint === index) {
      setExpandedPoint(newIndex)
    } else if (expandedPoint === newIndex) {
      setExpandedPoint(index)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Delivery Points</h3>
            <p className="text-sm text-muted-foreground">
              {deliveryPoints.length === 0 
                ? "No delivery points added" 
                : `${deliveryPoints.length} delivery point${deliveryPoints.length > 1 ? 's' : ''} configured`}
            </p>
          </div>
        </div>
        <Button type="button" onClick={addDeliveryPoint} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Delivery Point
        </Button>
      </div>

      {deliveryPoints.length === 0 ? (
        <Card className="border-dashed border-2 p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">No delivery points added yet</p>
          <p className="text-sm text-muted-foreground/70">Click "Add Delivery Point" above to start adding delivery locations</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveryPoints.map((point, index) => {
            const isExpanded = expandedPoint === index
            const hasBasicInfo = point.location_name && point.address
            const hasQuantities = (point.weight_kg && point.weight_kg > 0) || (point.pieces && point.pieces > 0) || (point.pallets && point.pallets > 0)
            
            return (
              <Card
                key={index}
                className={`border transition-all ${
                  isExpanded ? "border-primary/50 shadow-md" : "border-border hover:border-primary/30"
                }`}
              >
                {/* Summary Header - Always Visible */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedPoint(isExpanded ? null : index)}
                >
                  <div className="flex items-center gap-4">
                    {/* Delivery Number Badge */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                        <span className="text-sm font-bold text-primary">{point.delivery_number}</span>
                      </div>
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground truncate">
                          {point.location_name || `Delivery Point #${point.delivery_number}`}
                        </h4>
                        {point.priority && point.priority !== "normal" && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            point.priority === "high" 
                              ? "bg-red-500/20 text-red-400" 
                              : "bg-blue-500/20 text-blue-400"
                          }`}>
                            {point.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {point.address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate">{point.address}</span>
                          </div>
                        )}
                        {hasQuantities && (
                          <div className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            <span>
                              {point.weight_kg ? `${point.weight_kg}kg` : ''}
                              {point.pieces ? ` • ${point.pieces} pcs` : ''}
                              {point.pallets ? ` • ${point.pallets} pallets` : ''}
                            </span>
                          </div>
                        )}
                        {point.scheduled_delivery_date && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{new Date(point.scheduled_delivery_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveDeliveryPoint(index, "up")
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                      )}
                      {index < deliveryPoints.length - 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveDeliveryPoint(index, "down")
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeDeliveryPoint(index)
                        }}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight 
                        className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border bg-secondary/30">
                    <div className="p-6 space-y-6">
                      {/* Section 1: Location Information */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="w-4 h-4 text-primary" />
                          <h5 className="font-semibold text-foreground">Location Information</h5>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <Label>Location Name *</Label>
                            <Input
                              value={point.location_name}
                              onChange={(e) => updateDeliveryPoint(index, "location_name", e.target.value)}
                              placeholder="e.g., Costco Wholesale: Brandon #0358"
                              className="mt-1.5"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Street Address *</Label>
                            <Input
                              value={point.address}
                              onChange={(e) => updateDeliveryPoint(index, "address", e.target.value)}
                              placeholder="123 Main Street"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Location ID</Label>
                            <Input
                              value={point.location_id || ""}
                              onChange={(e) => updateDeliveryPoint(index, "location_id", e.target.value)}
                              placeholder="e.g., COST0358"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>City</Label>
                            <Input
                              value={point.city || ""}
                              onChange={(e) => updateDeliveryPoint(index, "city", e.target.value)}
                              placeholder="City name"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>State</Label>
                            <Input
                              value={point.state || ""}
                              onChange={(e) => updateDeliveryPoint(index, "state", e.target.value)}
                              placeholder="State"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>ZIP Code</Label>
                            <Input
                              value={point.zip || ""}
                              onChange={(e) => updateDeliveryPoint(index, "zip", e.target.value)}
                              placeholder="ZIP code"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Phone</Label>
                            <Input
                              value={point.phone || ""}
                              onChange={(e) => updateDeliveryPoint(index, "phone", e.target.value)}
                              placeholder="Phone number"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Contact Name</Label>
                            <Input
                              value={point.contact_name || ""}
                              onChange={(e) => updateDeliveryPoint(index, "contact_name", e.target.value)}
                              placeholder="Contact person"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Load Quantities */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Package className="w-4 h-4 text-primary" />
                          <h5 className="font-semibold text-foreground">Load Quantities for This Delivery</h5>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <Label>Weight (kg)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={point.weight_kg || ""}
                              onChange={(e) => updateDeliveryPoint(index, "weight_kg", parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Weight (lbs)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={point.weight_lbs || ""}
                              onChange={(e) => updateDeliveryPoint(index, "weight_lbs", parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Volume (m³)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={point.volume_cubic_meters || ""}
                              onChange={(e) => updateDeliveryPoint(index, "volume_cubic_meters", parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Pieces</Label>
                            <Input
                              type="number"
                              value={point.pieces || 0}
                              onChange={(e) => updateDeliveryPoint(index, "pieces", parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Pallets</Label>
                            <Input
                              type="number"
                              value={point.pallets || 0}
                              onChange={(e) => updateDeliveryPoint(index, "pallets", parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Boxes</Label>
                            <Input
                              type="number"
                              value={point.boxes || 0}
                              onChange={(e) => updateDeliveryPoint(index, "boxes", parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Carts</Label>
                            <Input
                              type="number"
                              value={point.carts || 0}
                              onChange={(e) => updateDeliveryPoint(index, "carts", parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Delivery Details */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <FileText className="w-4 h-4 text-primary" />
                          <h5 className="font-semibold text-foreground">Delivery Details</h5>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <Label>Delivery Type</Label>
                            <Select
                              value={point.delivery_type || "delivery"}
                              onValueChange={(value) => updateDeliveryPoint(index, "delivery_type", value)}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="delivery">Delivery</SelectItem>
                                <SelectItem value="pickup">Pickup</SelectItem>
                                <SelectItem value="drop_off">Drop Off</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Priority</Label>
                            <Select
                              value={point.priority || "normal"}
                              onValueChange={(value) => updateDeliveryPoint(index, "priority", value === "normal" ? undefined : value)}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Normal" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Reference Number</Label>
                            <Input
                              value={point.reference_number || ""}
                              onChange={(e) => updateDeliveryPoint(index, "reference_number", e.target.value)}
                              placeholder="Reference #"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Delivery Requirements */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Package className="w-4 h-4 text-primary" />
                          <h5 className="font-semibold text-foreground">Delivery Requirements</h5>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-secondary/50">
                            <input
                              type="checkbox"
                              id={`liftgate-${index}`}
                              checked={point.requires_liftgate || false}
                              onChange={(e) => updateDeliveryPoint(index, "requires_liftgate", e.target.checked)}
                              className="rounded w-4 h-4"
                            />
                            <Label htmlFor={`liftgate-${index}`} className="cursor-pointer font-normal">Requires Liftgate</Label>
                          </div>
                          <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-secondary/50">
                            <input
                              type="checkbox"
                              id={`inside-${index}`}
                              checked={point.requires_inside_delivery || false}
                              onChange={(e) => updateDeliveryPoint(index, "requires_inside_delivery", e.target.checked)}
                              className="rounded w-4 h-4"
                            />
                            <Label htmlFor={`inside-${index}`} className="cursor-pointer font-normal">Inside Delivery</Label>
                          </div>
                          <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-secondary/50">
                            <input
                              type="checkbox"
                              id={`appointment-${index}`}
                              checked={point.requires_appointment || false}
                              onChange={(e) => updateDeliveryPoint(index, "requires_appointment", e.target.checked)}
                              className="rounded w-4 h-4"
                            />
                            <Label htmlFor={`appointment-${index}`} className="cursor-pointer font-normal">Requires Appointment</Label>
                          </div>
                        </div>
                        {point.requires_appointment && (
                          <div className="mt-4">
                            <Label>Appointment Time</Label>
                            <Input
                              type="datetime-local"
                              value={point.appointment_time || ""}
                              onChange={(e) => updateDeliveryPoint(index, "appointment_time", e.target.value)}
                              className="mt-1.5 max-w-md"
                            />
                          </div>
                        )}
                      </div>

                      {/* Section 5: Scheduled Delivery */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="w-4 h-4 text-primary" />
                          <h5 className="font-semibold text-foreground">Scheduled Delivery</h5>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label>Scheduled Date</Label>
                            <Input
                              type="date"
                              value={point.scheduled_delivery_date || ""}
                              onChange={(e) => updateDeliveryPoint(index, "scheduled_delivery_date", e.target.value)}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Scheduled Time</Label>
                            <Input
                              type="time"
                              value={point.scheduled_delivery_time || ""}
                              onChange={(e) => updateDeliveryPoint(index, "scheduled_delivery_time", e.target.value)}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Time Window Start</Label>
                            <Input
                              type="time"
                              value={point.time_window_start || ""}
                              onChange={(e) => updateDeliveryPoint(index, "time_window_start", e.target.value)}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Time Window End</Label>
                            <Input
                              type="time"
                              value={point.time_window_end || ""}
                              onChange={(e) => updateDeliveryPoint(index, "time_window_end", e.target.value)}
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 6: Additional Information */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <FileText className="w-4 h-4 text-primary" />
                          <h5 className="font-semibold text-foreground">Additional Information</h5>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label>Delivery Instructions</Label>
                            <Textarea
                              value={point.delivery_instructions || ""}
                              onChange={(e) => updateDeliveryPoint(index, "delivery_instructions", e.target.value)}
                              placeholder="Special delivery instructions..."
                              className="mt-1.5"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label>Special Handling</Label>
                            <Input
                              value={point.special_handling || ""}
                              onChange={(e) => updateDeliveryPoint(index, "special_handling", e.target.value)}
                              placeholder="e.g., Fragile, Refrigerated, Hazmat"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Notes</Label>
                            <Textarea
                              value={point.notes || ""}
                              onChange={(e) => updateDeliveryPoint(index, "notes", e.target.value)}
                              placeholder="Additional notes..."
                              className="mt-1.5"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
