"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Edit, DollarSign, Fuel, Calendar, MapPin, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  getFuelPurchases,
  createFuelPurchase,
  updateFuelPurchase,
  deleteFuelPurchase,
} from "@/app/actions/tax-fuel-reconciliation"
import { getTrucks } from "@/app/actions/trucks"
import { getDrivers } from "@/app/actions/drivers"
import { uploadReceiptAndExtract } from "@/app/actions/receipt-ocr"

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
]

export default function TaxFuelReconciliationPage() {
  const [fuelPurchases, setFuelPurchases] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<any>(null)
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    state: "",
    truckId: "",
  })

  const [formData, setFormData] = useState({
    truck_id: "",
    driver_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    state: "",
    city: "",
    station_name: "",
    gallons: "",
    price_per_gallon: "",
    odometer_reading: "",
    receipt_number: "",
    receipt_url: "",
    notes: "",
  })

  useEffect(() => {
    loadData()
  }, [filters])

  async function loadData() {
    setLoading(true)
    try {
      // Load fuel purchases
      const purchasesResult = await getFuelPurchases({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        state: filters.state || undefined,
        truckId: filters.truckId || undefined,
        limit: 100,
      })
      if (purchasesResult.error) {
        toast.error(purchasesResult.error)
      } else {
        setFuelPurchases(purchasesResult.data || [])
      }

      // Load trucks and drivers for dropdowns
      const trucksResult = await getTrucks()
      if (!trucksResult.error && trucksResult.data) {
        setTrucks(trucksResult.data)
      }

      const driversResult = await getDrivers()
      if (!driversResult.error && driversResult.data) {
        setDrivers(driversResult.data)
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!formData.purchase_date || !formData.state || !formData.gallons || !formData.price_per_gallon) {
      toast.error("Purchase date, state, gallons, and price per gallon are required")
      return
    }

    try {
      const result = await createFuelPurchase({
        truck_id: formData.truck_id || undefined,
        driver_id: formData.driver_id || undefined,
        purchase_date: formData.purchase_date,
        state: formData.state,
        city: formData.city || undefined,
        station_name: formData.station_name || undefined,
        gallons: parseFloat(formData.gallons),
        price_per_gallon: parseFloat(formData.price_per_gallon),
        odometer_reading: formData.odometer_reading ? parseInt(formData.odometer_reading) : undefined,
        receipt_number: formData.receipt_number || undefined,
        receipt_url: formData.receipt_url || undefined,
        notes: formData.notes || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Fuel purchase created successfully")
        setShowCreateDialog(false)
        resetForm()
        loadData()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create fuel purchase")
    }
  }

  async function handleUpdate() {
    if (!editingPurchase || !formData.purchase_date || !formData.state || !formData.gallons || !formData.price_per_gallon) {
      toast.error("Purchase date, state, gallons, and price per gallon are required")
      return
    }

    try {
      const result = await updateFuelPurchase(editingPurchase.id, {
        truck_id: formData.truck_id || undefined,
        driver_id: formData.driver_id || undefined,
        purchase_date: formData.purchase_date,
        state: formData.state,
        city: formData.city || undefined,
        station_name: formData.station_name || undefined,
        gallons: parseFloat(formData.gallons),
        price_per_gallon: parseFloat(formData.price_per_gallon),
        odometer_reading: formData.odometer_reading ? parseInt(formData.odometer_reading) : undefined,
        receipt_number: formData.receipt_number || undefined,
        receipt_url: formData.receipt_url || undefined,
        notes: formData.notes || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Fuel purchase updated successfully")
        setEditingPurchase(null)
        resetForm()
        loadData()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update fuel purchase")
    }
  }

  async function handleDelete(id: string) {
    try {
      const result = await deleteFuelPurchase(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Fuel purchase deleted successfully")
        loadData()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete fuel purchase")
    }
  }

  function resetForm() {
    setFormData({
      truck_id: "",
      driver_id: "",
      purchase_date: new Date().toISOString().split("T")[0],
      state: "",
      city: "",
      station_name: "",
      gallons: "",
      price_per_gallon: "",
      odometer_reading: "",
      receipt_number: "",
      receipt_url: "",
      notes: "",
    })
  }

  function handleEdit(purchase: any) {
    setEditingPurchase(purchase)
    setFormData({
      truck_id: purchase.truck_id || "",
      driver_id: purchase.driver_id || "",
      purchase_date: purchase.purchase_date || new Date().toISOString().split("T")[0],
      state: purchase.state || "",
      city: purchase.city || "",
      station_name: purchase.station_name || "",
      gallons: purchase.gallons?.toString() || "",
      price_per_gallon: purchase.price_per_gallon?.toString() || "",
      odometer_reading: purchase.odometer_reading?.toString() || "",
      receipt_number: purchase.receipt_number || "",
      receipt_url: purchase.receipt_url || "",
      notes: purchase.notes || "",
    })
    setShowCreateDialog(true)
  }

  async function handleReceiptUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, etc.)")
      return
    }

    setIsUploadingReceipt(true)
    try {
      const result = await uploadReceiptAndExtract(file)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        // Pre-fill form with extracted data
        setFormData({
          truck_id: "",
          driver_id: "",
          purchase_date: result.data.purchase_date || new Date().toISOString().split("T")[0],
          state: result.data.state || "",
          city: result.data.city || "",
          station_name: result.data.station_name || "",
          gallons: result.data.gallons?.toString() || "",
          price_per_gallon: result.data.price_per_gallon?.toString() || "",
          odometer_reading: result.data.odometer_reading?.toString() || "",
          receipt_number: result.data.receipt_number || "",
          receipt_url: result.data.receipt_url || "",
          notes: "",
        })
        setShowCreateDialog(true)
        toast.success("Receipt data extracted! Please review and save.")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to process receipt")
    } finally {
      setIsUploadingReceipt(false)
      event.target.value = "" // Reset input
    }
  }

  const totalGallons = fuelPurchases.reduce((sum, p) => sum + parseFloat(p.gallons?.toString() || "0"), 0)
  const totalCost = fuelPurchases.reduce((sum, p) => sum + parseFloat(p.total_cost?.toString() || "0"), 0)
  const avgPricePerGallon = totalGallons > 0 ? totalCost / totalGallons : 0

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tax & Fuel Reconciliation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track fuel purchases for IFTA reporting and tax reconciliation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/accounting/tax-fuel/import">
            <Button
              variant="outline"
              className="border-border bg-transparent hover:bg-secondary/50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Fuel Card
            </Button>
          </Link>
          <input
            type="file"
            id="receipt-upload"
            className="hidden"
            accept="image/*"
            onChange={handleReceiptUpload}
            disabled={isUploadingReceipt}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById("receipt-upload")?.click()}
            disabled={isUploadingReceipt}
            className="border-border bg-transparent hover:bg-secondary/50"
          >
            {isUploadingReceipt ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Scan Receipt
              </>
            )}
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open)
            if (!open) {
              setEditingPurchase(null)
              resetForm()
            }
          }}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm()
                  setEditingPurchase(null)
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Fuel Purchase
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPurchase ? "Edit Fuel Purchase" : "Add Fuel Purchase"}</DialogTitle>
              <DialogDescription>
                Record a fuel purchase for IFTA reporting and tax reconciliation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchase_date">Purchase Date *</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City name"
                />
              </div>
              <div>
                <Label htmlFor="station_name">Station Name</Label>
                <Input
                  id="station_name"
                  value={formData.station_name}
                  onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                  placeholder="Gas station name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gallons">Gallons *</Label>
                  <Input
                    id="gallons"
                    type="number"
                    step="0.01"
                    value={formData.gallons}
                    onChange={(e) => setFormData({ ...formData, gallons: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="price_per_gallon">Price per Gallon ($) *</Label>
                  <Input
                    id="price_per_gallon"
                    type="number"
                    step="0.0001"
                    value={formData.price_per_gallon}
                    onChange={(e) => setFormData({ ...formData, price_per_gallon: e.target.value })}
                    placeholder="0.0000"
                  />
                </div>
              </div>
              {formData.gallons && formData.price_per_gallon && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Total Cost: ${(parseFloat(formData.gallons) * parseFloat(formData.price_per_gallon)).toFixed(2)}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="truck_id">Truck</Label>
                  <Select value={formData.truck_id || undefined} onValueChange={(value) => setFormData({ ...formData, truck_id: value === "none" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select truck (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.truck_number} - {truck.make} {truck.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="driver_id">Driver</Label>
                  <Select value={formData.driver_id || undefined} onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="odometer_reading">Odometer Reading</Label>
                <Input
                  id="odometer_reading"
                  type="number"
                  value={formData.odometer_reading}
                  onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                  placeholder="Miles"
                />
              </div>
              <div>
                <Label htmlFor="receipt_number">Receipt Number</Label>
                <Input
                  id="receipt_number"
                  value={formData.receipt_number}
                  onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                  placeholder="Receipt #"
                />
              </div>
              <div>
                <Label htmlFor="receipt_url">Receipt URL</Label>
                <Input
                  id="receipt_url"
                  type="url"
                  value={formData.receipt_url}
                  onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={editingPurchase ? handleUpdate : handleCreate}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {editingPurchase ? "Update" : "Create"} Purchase
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false)
                    resetForm()
                    setEditingPurchase(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border border-border/50 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Fuel className="w-5 h-5 text-primary" />
                <p className="text-muted-foreground text-sm font-medium">Total Gallons</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{totalGallons.toFixed(2)}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <p className="text-muted-foreground text-sm font-medium">Total Cost</p>
              </div>
              <p className="text-3xl font-bold text-foreground">${totalCost.toFixed(2)}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <p className="text-muted-foreground text-sm font-medium">Avg Price/Gallon</p>
              </div>
              <p className="text-3xl font-bold text-foreground">${avgPricePerGallon.toFixed(4)}</p>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="filter_state">State</Label>
                <Select value={filters.state || undefined} onValueChange={(value) => setFilters({ ...filters, state: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter_truck">Truck</Label>
                <Select value={filters.truckId || undefined} onValueChange={(value) => setFilters({ ...filters, truckId: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All trucks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trucks</SelectItem>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.truck_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Fuel Purchases Table */}
          {loading ? (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">Loading fuel purchases...</p>
            </Card>
          ) : fuelPurchases.length === 0 ? (
            <Card className="p-8">
              <div className="text-center py-12">
                <Fuel className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No fuel purchases</h3>
                <p className="text-muted-foreground">Start tracking fuel purchases for IFTA reporting</p>
              </div>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Gallons</TableHead>
                    <TableHead>Price/Gal</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Truck</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fuelPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        {new Date(purchase.purchase_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{purchase.state}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          {purchase.station_name && <p className="font-medium">{purchase.station_name}</p>}
                          {purchase.city && <p className="text-xs text-muted-foreground">{purchase.city}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{parseFloat(purchase.gallons?.toString() || "0").toFixed(2)}</TableCell>
                      <TableCell>${parseFloat(purchase.price_per_gallon?.toString() || "0").toFixed(4)}</TableCell>
                      <TableCell className="font-medium">
                        ${parseFloat(purchase.total_cost?.toString() || "0").toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {purchase.trucks ? (
                          <span className="text-sm">{purchase.trucks.truck_number}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {purchase.drivers ? (
                          <span className="text-sm">{purchase.drivers.name}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(purchase)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the fuel purchase record.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(purchase.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

