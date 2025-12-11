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
import { Plus, Trash2, GripVertical, MapPin } from "lucide-react"
import { toast } from "sonner"

interface Stop {
  id?: string
  stop_number: number
  location_name: string
  location_id?: string
  address: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  stop_type?: string
  priority?: string
  salesman_id?: string
  arrive_time?: string
  depart_time?: string
  service_time_minutes?: number
  travel_time_minutes?: number
  time_window_1_open?: string
  time_window_1_close?: string
  time_window_2_open?: string
  time_window_2_close?: string
  carts?: number
  boxes?: number
  pallets?: number
  orders?: number
  quantity_type?: string
  special_instructions?: string
  notes?: string
}

interface RouteStopsManagerProps {
  stops: Stop[]
  onStopsChange: (stops: Stop[]) => void
}

export function RouteStopsManager({ stops, onStopsChange }: RouteStopsManagerProps) {
  const [expandedStop, setExpandedStop] = useState<number | null>(null)

  const addStop = () => {
    const newStop: Stop = {
      stop_number: stops.length + 1,
      location_name: "",
      address: "",
      stop_type: "delivery",
      quantity_type: "delivery",
      carts: 0,
      boxes: 0,
      pallets: 0,
      orders: 0,
    }
    onStopsChange([...stops, newStop])
    setExpandedStop(stops.length)
  }

  const removeStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index).map((stop, i) => ({
      ...stop,
      stop_number: i + 1,
    }))
    onStopsChange(newStops)
    if (expandedStop === index) {
      setExpandedStop(null)
    } else if (expandedStop !== null && expandedStop > index) {
      setExpandedStop(expandedStop - 1)
    }
  }

  const updateStop = (index: number, field: keyof Stop, value: any) => {
    const newStops = [...stops]
    newStops[index] = { ...newStops[index], [field]: value }
    onStopsChange(newStops)
  }

  const moveStop = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === stops.length - 1)
    ) {
      return
    }

    const newStops = [...stops]
    const newIndex = direction === "up" ? index - 1 : index + 1
    ;[newStops[index], newStops[newIndex]] = [newStops[newIndex], newStops[index]]

    // Update stop numbers
    newStops.forEach((stop, i) => {
      stop.stop_number = i + 1
    })

    onStopsChange(newStops)
    if (expandedStop === index) {
      setExpandedStop(newIndex)
    } else if (expandedStop === newIndex) {
      setExpandedStop(index)
    }
  }

  return (
    <Card className="border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Route Stops</h2>
          <span className="text-sm text-muted-foreground">({stops.length})</span>
        </div>
        <Button type="button" onClick={addStop} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Stop
        </Button>
      </div>

      {stops.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No stops added yet. Click "Add Stop" to create a multi-stop route.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stops.map((stop, index) => (
            <Card
              key={index}
              className={`border-border p-4 ${
                expandedStop === index ? "bg-secondary/30" : "bg-card"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{stop.stop_number}</span>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Location Name (e.g., Costco Wholesale: Brandon #0358)"
                    value={stop.location_name}
                    onChange={(e) => updateStop(index, "location_name", e.target.value)}
                    className="font-semibold"
                  />
                </div>
                <div className="flex gap-2">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveStop(index, "up")}
                    >
                      ↑
                    </Button>
                  )}
                  {index < stops.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveStop(index, "down")}
                    >
                      ↓
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedStop(expandedStop === index ? null : index)
                    }
                  >
                    {expandedStop === index ? "Collapse" : "Expand"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStop(index)}
                    className="text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Basic Fields (Always Visible) */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>Address *</Label>
                  <Input
                    value={stop.address}
                    onChange={(e) => updateStop(index, "address", e.target.value)}
                    placeholder="Street address"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Location ID</Label>
                  <Input
                    value={stop.location_id || ""}
                    onChange={(e) => updateStop(index, "location_id", e.target.value)}
                    placeholder="e.g., COST0358"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedStop === index && (
                <div className="space-y-4 pt-4 border-t border-border">
                  {/* Location Details */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Location Details</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label>City</Label>
                        <Input
                          value={stop.city || ""}
                          onChange={(e) => updateStop(index, "city", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input
                          value={stop.state || ""}
                          onChange={(e) => updateStop(index, "state", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>ZIP</Label>
                        <Input
                          value={stop.zip || ""}
                          onChange={(e) => updateStop(index, "zip", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={stop.phone || ""}
                          onChange={(e) => updateStop(index, "phone", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Contact Name</Label>
                        <Input
                          value={stop.contact_name || ""}
                          onChange={(e) => updateStop(index, "contact_name", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stop Details */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Stop Details</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label>Stop Type</Label>
                        <Select
                          value={stop.stop_type || "delivery"}
                          onValueChange={(value) => updateStop(index, "stop_type", value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="pickup">Pickup</SelectItem>
                            <SelectItem value="sit">SIT</SelectItem>
                            <SelectItem value="depot">Depot</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Select
                          value={stop.priority || "normal"}
                          onValueChange={(value) => updateStop(index, "priority", value === "normal" ? undefined : value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Normal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="C">After Closing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Salesman ID</Label>
                        <Input
                          value={stop.salesman_id || ""}
                          onChange={(e) => updateStop(index, "salesman_id", e.target.value)}
                          placeholder="/"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timing */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Timing</h4>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <Label>Arrive Time</Label>
                        <Input
                          type="time"
                          value={stop.arrive_time || ""}
                          onChange={(e) => updateStop(index, "arrive_time", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Depart Time</Label>
                        <Input
                          type="time"
                          value={stop.depart_time || ""}
                          onChange={(e) => updateStop(index, "depart_time", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Service Time (minutes)</Label>
                        <Input
                          type="number"
                          value={stop.service_time_minutes || ""}
                          onChange={(e) =>
                            updateStop(index, "service_time_minutes", parseInt(e.target.value) || 0)
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Travel Time (minutes)</Label>
                        <Input
                          type="number"
                          value={stop.travel_time_minutes || ""}
                          onChange={(e) =>
                            updateStop(index, "travel_time_minutes", parseInt(e.target.value) || 0)
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Time Windows */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Time Windows</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Time Window 1</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <Input
                            type="time"
                            value={stop.time_window_1_open || ""}
                            onChange={(e) => updateStop(index, "time_window_1_open", e.target.value)}
                            placeholder="Open"
                          />
                          <Input
                            type="time"
                            value={stop.time_window_1_close || ""}
                            onChange={(e) => updateStop(index, "time_window_1_close", e.target.value)}
                            placeholder="Close"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Time Window 2 (Optional)</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <Input
                            type="time"
                            value={stop.time_window_2_open || ""}
                            onChange={(e) => updateStop(index, "time_window_2_open", e.target.value)}
                            placeholder="Open"
                          />
                          <Input
                            type="time"
                            value={stop.time_window_2_close || ""}
                            onChange={(e) => updateStop(index, "time_window_2_close", e.target.value)}
                            placeholder="Close"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quantities */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Quantities</h4>
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label>Quantity Type</Label>
                        <Select
                          value={stop.quantity_type || "delivery"}
                          onValueChange={(value) => updateStop(index, "quantity_type", value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="pickup">Pickup</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <Label>Carts</Label>
                        <Input
                          type="number"
                          value={stop.carts || 0}
                          onChange={(e) => updateStop(index, "carts", parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Boxes</Label>
                        <Input
                          type="number"
                          value={stop.boxes || 0}
                          onChange={(e) => updateStop(index, "boxes", parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Pallets</Label>
                        <Input
                          type="number"
                          value={stop.pallets || 0}
                          onChange={(e) => updateStop(index, "pallets", parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Orders</Label>
                        <Input
                          type="number"
                          value={stop.orders || 0}
                          onChange={(e) => updateStop(index, "orders", parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Additional Information</h4>
                    <div className="space-y-4">
                      <div>
                        <Label>Special Instructions</Label>
                        <Textarea
                          value={stop.special_instructions || ""}
                          onChange={(e) => updateStop(index, "special_instructions", e.target.value)}
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={stop.notes || ""}
                          onChange={(e) => updateStop(index, "notes", e.target.value)}
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Card>
  )
}

