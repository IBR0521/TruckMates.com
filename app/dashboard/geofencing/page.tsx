"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Search, MapPin, Edit, Trash2, Eye } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
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
import { getGeofences, deleteGeofence } from "@/app/actions/geofencing"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function GeofencingPage() {
  const [geofences, setGeofences] = useState<any[]>([])
  const [filteredGeofences, setFilteredGeofences] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadGeofences()
  }, [])

  useEffect(() => {
    let filtered = [...geofences]
    
    if (searchTerm) {
      filtered = filtered.filter(
        (geofence) =>
          geofence.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          geofence.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          geofence.address?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (statusFilter === "active") {
      filtered = filtered.filter((g) => g.is_active)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((g) => !g.is_active)
    }
    
    setFilteredGeofences(filtered)
  }, [geofences, searchTerm, statusFilter])

  async function loadGeofences() {
    setIsLoading(true)
    const result = await getGeofences()
    if (result.error) {
      toast.error(result.error)
    } else {
      setGeofences(result.data || [])
      setFilteredGeofences(result.data || [])
    }
    setIsLoading(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const result = await deleteGeofence(deleteId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Geofence deleted successfully")
      loadGeofences()
    }
    setDeleteId(null)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Geofencing Zones</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create and manage location zones for tracking and alerts
            </p>
          </div>
          <Link href="/dashboard/geofencing/add">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Zone
            </Button>
          </Link>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search zones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4 md:p-8">
        {isLoading ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Loading zones...</p>
          </Card>
        ) : filteredGeofences.length === 0 ? (
          <Card className="p-12 text-center">
            <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No geofencing zones yet</h3>
            <p className="text-muted-foreground mb-6">Create your first zone to start tracking vehicle entry and exit.</p>
            <Link href="/dashboard/geofencing/add">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Zone
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredGeofences.map((geofence) => (
              <Card key={geofence.id} className="p-6 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{geofence.name}</h3>
                    {geofence.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {geofence.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline">{geofence.zone_type}</Badge>
                  {geofence.is_active ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                  {geofence.alert_on_entry && <Badge variant="secondary">Entry Alert</Badge>}
                  {geofence.alert_on_exit && <Badge variant="secondary">Exit Alert</Badge>}
                </div>

                {geofence.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">
                      {geofence.address}
                      {geofence.city && `, ${geofence.city}`}
                      {geofence.state && `, ${geofence.state}`}
                    </span>
                  </div>
                )}

                {geofence.zone_type === "circle" && geofence.radius_meters && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Radius: {(geofence.radius_meters / 1000).toFixed(2)} km
                  </p>
                )}

                <div className="flex gap-2">
                  <Link href={`/dashboard/geofencing/${geofence.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(geofence.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Geofence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this geofencing zone? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

