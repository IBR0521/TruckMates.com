"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MapPin, Fuel, Download, Plus, Eye, Edit2, Trash2, Truck } from "lucide-react"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getTrucks, deleteTruck } from "@/app/actions/trucks"

export default function TrucksPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [trucksList, setTrucksList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadTrucks = async () => {
    setIsLoading(true)
    const result = await getTrucks()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setTrucksList(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadTrucks()
  }, [])

  const handleExportTrucks = () => {
    try {
      const exportData = trucksList.map(({ id, company_id, current_driver_id, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "vehicles")
      toast.success("Vehicles exported successfully")
    } catch (error) {
      toast.error("Failed to export vehicles")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteTruck(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Vehicle deleted successfully")
      setDeleteId(null)
      await loadTrucks()
    }
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Vehicles</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor your fleet status and details</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExportTrucks}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Link href="/dashboard/trucks/add" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Vehicle</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading trucks...</p>
              </div>
            </Card>
          ) : trucksList.length === 0 ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No trucks yet</h3>
                <p className="text-muted-foreground mb-6">Get started by adding your first truck to the fleet</p>
                <Link href="/dashboard/trucks/add">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Truck
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {trucksList.map((truck) => (
              <Card
                key={truck.id}
                className="border border-border/50 p-6 hover:border-border/80 hover:shadow-md transition-all shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{truck.truck_number || "N/A"}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{truck.make} {truck.model} {truck.year ? `(${truck.year})` : ""}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      truck.status === "in_use" || truck.status === "Active" ? "bg-green-500/20 text-green-400" : 
                      truck.status === "maintenance" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {truck.status ? truck.status.charAt(0).toUpperCase() + truck.status.slice(1).replace("_", " ") : "N/A"}
                  </span>
                </div>
                <div className="space-y-3 mb-6 border-t border-border/30 pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">License Plate</p>
                    <p className="text-sm text-foreground">{truck.license_plate || "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="text-sm text-foreground">{truck.current_location || "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-primary" />
                    <p className="text-sm text-foreground">{truck.fuel_level ? `${truck.fuel_level}%` : "N/A"}</p>
                  </div>
                  {truck.mileage && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Mileage</p>
                      <p className="text-sm text-foreground">{truck.mileage.toLocaleString()} mi</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border/50 bg-transparent hover:bg-secondary/50 transition"
                    onClick={() => router.push(`/dashboard/trucks/${truck.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Link href={`/dashboard/trucks/${truck.id}/edit`}>
                    <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-transparent hover:bg-red-500/20"
                    onClick={() => setDeleteId(truck.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the vehicle from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
