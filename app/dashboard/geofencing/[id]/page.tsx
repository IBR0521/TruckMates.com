"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DetailPageLayout, DetailSection } from "@/components/dashboard/detail-page-layout"
import { MapPin, Calendar, Truck, Route, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { getGeofence, updateGeofence, deleteGeofence } from "@/app/actions/geofencing"
import { getZoneVisits } from "@/app/actions/geofencing"
import { format } from "date-fns"
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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function GeofenceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const geofenceId = params.id as string
  const [geofence, setGeofence] = useState<any>(null)
  const [visits, setVisits] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    if (geofenceId) {
      loadGeofence()
      loadVisits()
    }
  }, [geofenceId])

  async function loadGeofence() {
    setIsLoading(true)
    const result = await getGeofence(geofenceId)
    if (result.error) {
      toast.error(result.error)
      router.push("/dashboard/geofencing")
    } else {
      setGeofence(result.data)
    }
    setIsLoading(false)
  }

  async function loadVisits() {
    const result = await getZoneVisits({ geofence_id: geofenceId })
    if (result.data) {
      setVisits(result.data.slice(0, 50)) // Last 50 visits
    }
  }

  async function handleToggleActive() {
    if (!geofence) return
    const result = await updateGeofence(geofenceId, { is_active: !geofence.is_active })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Zone ${!geofence.is_active ? "activated" : "deactivated"}`)
      loadGeofence()
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteGeofence(geofenceId)
    setIsDeleting(false)
    setShowDeleteDialog(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Geofence deleted successfully")
      router.push("/dashboard/geofencing")
    }
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Loading geofence...</p>
        </Card>
      </div>
    )
  }

  if (!geofence) {
    return null
  }

  return (
    <DetailPageLayout
      title={geofence.name}
      subtitle={geofence.description || "Geofencing Zone Details"}
      backUrl="/dashboard/geofencing"
      actions={
        <>
          <Button variant="outline" onClick={handleToggleActive}>
            {geofence.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            Delete Zone
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <DetailSection
          title="Zone Information"
          icon={<MapPin className="w-5 h-5" />}
        >
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Zone Type</p>
              <Badge variant="outline">{geofence.zone_type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              {geofence.is_active ? (
                <Badge className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="outline">Inactive</Badge>
              )}
            </div>
            {geofence.zone_type === "circle" && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Center</p>
                  <p className="text-sm font-medium">
                    {geofence.center_latitude}, {geofence.center_longitude}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Radius</p>
                  <p className="text-sm font-medium">
                    {geofence.radius_meters ? `${(geofence.radius_meters / 1000).toFixed(2)} km` : "N/A"}
                  </p>
                </div>
              </>
            )}
            {geofence.address && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Address</p>
                <p className="text-sm font-medium">
                  {geofence.address}
                  {geofence.city && `, ${geofence.city}`}
                  {geofence.state && `, ${geofence.state}`}
                  {geofence.zip_code && ` ${geofence.zip_code}`}
                </p>
              </div>
            )}
          </div>
        </DetailSection>

        <DetailSection
          title="Alert Settings"
          icon={<AlertCircle className="w-5 h-5" />}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Entry Alert</p>
                <p className="text-sm text-muted-foreground">Alert when vehicle enters zone</p>
              </div>
              {geofence.alert_on_entry ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Exit Alert</p>
                <p className="text-sm text-muted-foreground">Alert when vehicle exits zone</p>
              </div>
              {geofence.alert_on_exit ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            {geofence.alert_on_dwell && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dwell Alert</p>
                  <p className="text-sm text-muted-foreground">
                    Alert if vehicle stays longer than {geofence.dwell_time_minutes || 30} minutes
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            )}
          </div>
        </DetailSection>

        {visits.length > 0 && (
          <DetailSection
            title="Recent Visits"
            icon={<Clock className="w-5 h-5" />}
          >
            <div className="space-y-2">
              {visits.slice(0, 10).map((visit) => (
                <div key={visit.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {visit.event_type === "entry" ? "Entry" : visit.event_type === "exit" ? "Exit" : "Dwell"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(visit.timestamp), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  {visit.duration_minutes && (
                    <Badge variant="outline">
                      {visit.duration_minutes} min
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </DetailSection>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Geofence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this geofencing zone? This will also delete all visit records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPageLayout>
  )
}


