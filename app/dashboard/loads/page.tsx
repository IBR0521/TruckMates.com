"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Package, Download, Eye, Edit2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { exportToExcel } from "@/lib/export-utils"
import { TruckMap } from "@/components/truck-map"
import { toast } from "sonner"
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
import { getLoads, deleteLoad } from "@/app/actions/loads"

export default function LoadsPage() {
  const router = useRouter()
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loadsList, setLoadsList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadLoads = async () => {
    setIsLoading(true)
    try {
      const result = await getLoads()
      if (result.error) {
        toast.error(result.error)
        setLoadsList([]) // Set empty array on error
        setIsLoading(false)
        return
      }
      if (result.data) {
        setLoadsList(result.data)
      } else {
        setLoadsList([])
      }
    } catch (error: any) {
      console.error("Error loading loads:", error)
      toast.error("Failed to load loads. Please try again.")
      setLoadsList([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLoads()
  }, [])

  const handleExportLoads = () => {
    try {
      const exportData = loadsList.map(({ id, company_id, route_id, driver_id, truck_id, coordinates, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "loads")
      toast.success("Loads exported successfully")
    } catch (error) {
      toast.error("Failed to export loads")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteLoad(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      if (selectedLoad?.id === id) {
        setSelectedLoad(null)
      }
      toast.success("Load deleted successfully")
      setDeleteId(null)
      await loadLoads()
    }
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Loads</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage shipments and track deliveries</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExportLoads}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Link href="/dashboard/loads/add" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Load</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Loads List */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <Card className="border-border p-8">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading loads...</p>
                </div>
              </Card>
            ) : loadsList.length === 0 ? (
              <Card className="border-border p-8">
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No loads yet</h3>
                  <p className="text-muted-foreground mb-6">Get started by creating your first load</p>
                  <Link href="/dashboard/loads/add">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Load
                    </Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {loadsList.map((load) => (
                <Card
                  key={load.id}
                  className="border-border p-4 md:p-6 hover:border-primary/50 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Shipment</p>
                        <p className="font-bold text-foreground">{load.shipment_number || "N/A"}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        load.status === "in_transit" || load.status === "In Transit" ? "bg-green-400/20 text-green-400" : 
                        load.status === "delivered" || load.status === "Delivered" ? "bg-gray-400/20 text-gray-400" :
                        "bg-blue-400/20 text-blue-400"
                      }`}
                    >
                      {load.status ? load.status.charAt(0).toUpperCase() + load.status.slice(1).replace("_", " ") : "N/A"}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground">Weight: {load.weight || `${load.weight_kg ? (load.weight_kg / 1000).toFixed(1) : 0} tons`}</p>
                      {load.delivery_type === "multi" && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                          {load.total_delivery_points || 0} Delivery Points
                        </span>
                      )}
                      {load.delivery_type === "single" && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                          Single Delivery
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">From: {load.origin || "N/A"}</p>
                    {load.delivery_type === "single" ? (
                      <p className="text-muted-foreground">To: {load.destination || "N/A"}</p>
                    ) : (
                      <p className="text-muted-foreground">Multiple Destinations: {load.total_delivery_points || 0} locations</p>
                    )}
                    <p className="text-muted-foreground">Contents: {load.contents || "N/A"}</p>
                    {load.company_name && (
                      <p className="text-muted-foreground">Company: {load.company_name}</p>
                    )}
                    <p className="text-muted-foreground">Est. Delivery: {load.estimated_delivery ? (() => {
                      try {
                        const date = new Date(load.estimated_delivery)
                        return isNaN(date.getTime()) ? "N/A" : date.toISOString().split('T')[0]
                      } catch {
                        return "N/A"
                      }
                    })() : "N/A"}</p>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-border/30">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-border/50 bg-transparent hover:bg-secondary/50"
                      onClick={() => {
                        setSelectedLoad(load)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                    <Link href={`/dashboard/loads/${load.id}/edit`}>
                      <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 bg-transparent hover:bg-red-500/20"
                      onClick={() => setDeleteId(load.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </Card>
                ))}
              </div>
            )}
          </div>

          {/* Map View */}
          <div className="lg:col-span-1">
            <Card className="border-border p-6 sticky top-8">
              {selectedLoad ? (
                <TruckMap
                  origin={selectedLoad.origin || ""}
                  destination={selectedLoad.destination || ""}
                  weight={selectedLoad.weight_kg || 0}
                  truckHeight={4.2}
                  contents={selectedLoad.contents || ""}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-center py-12">
                  <div>
                    <Package className="w-12 h-12 text-primary/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Select a load to view truck route</p>
                    <p className="text-xs text-muted-foreground mt-1">Route will show truck-approved paths</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the load from the system.
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
