"use client"

import { Button } from "@/components/ui/button"
import { Fuel, Wrench, User, Truck, Calendar, FileText, Hash, MapPin, Gauge } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getTruck } from "@/app/actions/trucks"
import { getDriver } from "@/app/actions/drivers"
import { toast } from "sonner"
import { 
  DetailPageLayout, 
  DetailSection, 
  InfoGrid, 
  InfoField, 
  StatusBadge 
} from "@/components/dashboard/detail-page-layout"

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [truck, setTruck] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/trucks/add")
      return
    }
    loadTruck()
  }, [id, router])

  async function loadTruck() {
    setIsLoading(true)
    try {
      const result = await getTruck(id)
      if (result.error) {
        toast.error(result.error)
        router.push("/dashboard/trucks")
        return
      }
      setTruck(result.data)

      // Load driver if assigned
      if (result.data?.current_driver_id) {
        const driverResult = await getDriver(result.data.current_driver_id)
        if (driverResult.data) {
          setDriver(driverResult.data)
        }
      }
    } catch (error: any) {
      toast.error("Failed to load truck details")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <DetailPageLayout
        title="Loading..."
        backUrl="/dashboard/trucks"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading vehicle details...</p>
        </div>
      </DetailPageLayout>
    )
  }

  if (!truck) {
    return (
      <DetailPageLayout
        title="Vehicle Not Found"
        backUrl="/dashboard/trucks"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Vehicle not found.</p>
        </div>
      </DetailPageLayout>
    )
  }

  const getStatusVariant = (status: string): "success" | "default" | "warning" | "danger" | "info" => {
    switch (status?.toLowerCase()) {
      case "available":
        return "success"
      case "in_use":
        return "info"
      case "maintenance":
        return "warning"
      case "out_of_service":
        return "danger"
      default:
        return "default"
    }
  }

  return (
    <DetailPageLayout
      title={truck.truck_number || "Vehicle Details"}
      subtitle={truck.make && truck.model ? `${truck.make} ${truck.model}` : undefined}
      backUrl="/dashboard/trucks"
      editUrl={`/dashboard/trucks/${id}/edit`}
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <DetailSection
          title="Basic Information"
          icon={<Truck className="w-5 h-5" />}
          description="Vehicle identification and specifications"
        >
          <InfoGrid cols={2}>
            <InfoField
              label="Truck Number"
              value={truck.truck_number || "—"}
            />
            <InfoField
              label="Status"
              value={
                <StatusBadge 
                  status={truck.status?.replace("_", " ") || "Unknown"} 
                  variant={getStatusVariant(truck.status)}
                />
              }
            />
            {truck.make && (
              <InfoField
                label="Make"
                value={truck.make}
              />
            )}
            {truck.model && (
              <InfoField
                label="Model"
                value={truck.model}
              />
            )}
            {truck.year && (
              <InfoField
                label="Year"
                value={truck.year}
              />
            )}
            {truck.vin && (
              <InfoField
                label="VIN"
                value={<span className="font-mono text-sm">{truck.vin}</span>}
                icon={<Hash className="w-4 h-4" />}
              />
            )}
            {truck.license_plate && (
              <InfoField
                label="License Plate"
                value={truck.license_plate}
              />
            )}
            {truck.current_location && (
              <InfoField
                label="Current Location"
                value={truck.current_location}
                icon={<MapPin className="w-4 h-4" />}
                className="md:col-span-2"
              />
            )}
            {truck.fuel_type && (
              <InfoField
                label="Fuel Type"
                value={truck.fuel_type.charAt(0).toUpperCase() + truck.fuel_type.slice(1).replace("_", " ")}
              />
            )}
            {truck.color && (
              <InfoField
                label="Color"
                value={truck.color}
              />
            )}
            {truck.height && (
              <InfoField
                label="Height"
                value={truck.height}
              />
            )}
            {truck.gross_vehicle_weight && (
              <InfoField
                label="Gross Vehicle Weight"
                value={`${truck.gross_vehicle_weight.toLocaleString()} lbs`}
              />
            )}
            {truck.owner_name && (
              <InfoField
                label="Owner's Name"
                value={truck.owner_name}
              />
            )}
            {truck.cost && (
              <InfoField
                label="Cost"
                value={`$${parseFloat(truck.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            )}
            {truck.last_known_address && (
              <InfoField
                label="Last Known Address"
                value={truck.last_known_address}
                icon={<MapPin className="w-4 h-4" />}
                className="md:col-span-2"
              />
            )}
          </InfoGrid>
        </DetailSection>

        {/* Driver Assignment */}
        {driver && (
          <DetailSection
            title="Driver Assignment"
            icon={<User className="w-5 h-5" />}
            description="Currently assigned driver"
          >
            <InfoGrid cols={2}>
              <InfoField
                label="Driver"
                value={
                  <Link href={`/dashboard/drivers/${driver.id}`} className="text-primary hover:underline font-semibold">
                    {driver.name || "—"}
                  </Link>
                }
              />
              {driver.phone && (
                <InfoField
                  label="Phone"
                  value={
                    <a href={`tel:${driver.phone}`} className="text-primary hover:underline">
                      {driver.phone}
                    </a>
                  }
                />
              )}
            </InfoGrid>
          </DetailSection>
        )}

        {/* Fuel & Mileage */}
        <DetailSection
          title="Fuel & Mileage"
          icon={<Fuel className="w-5 h-5" />}
          description="Current fuel level and odometer reading"
        >
          <InfoGrid cols={2}>
            {truck.fuel_level !== null && truck.fuel_level !== undefined && (
              <InfoField
                label="Fuel Level"
                value={
                  <div className="space-y-2">
                    <span className="text-2xl font-bold">{truck.fuel_level}%</span>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          truck.fuel_level > 50 ? "bg-green-500" :
                          truck.fuel_level > 25 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${truck.fuel_level}%` }}
                      />
                    </div>
                  </div>
                }
              />
            )}
            {truck.mileage && (
              <InfoField
                label="Mileage"
                value={
                  <span className="text-2xl font-bold">
                    {parseInt(truck.mileage).toLocaleString()} miles
                  </span>
                }
                icon={<Gauge className="w-4 h-4" />}
              />
            )}
          </InfoGrid>
        </DetailSection>

        {/* Maintenance & Expiry */}
        {(truck.last_maintenance_date || truck.license_expiry || truck.insurance_expiry) && (
          <DetailSection
            title="Maintenance & Expiry"
            icon={<Wrench className="w-5 h-5" />}
            description="Maintenance schedule and document expiration dates"
          >
            <InfoGrid cols={2}>
              {truck.last_maintenance_date && (
                <InfoField
                  label="Last Maintenance"
                  value={new Date(truck.last_maintenance_date).toLocaleDateString()}
                  icon={<Calendar className="w-4 h-4" />}
                />
              )}
              {truck.license_expiry && (
                <InfoField
                  label="License Expiry"
                  value={new Date(truck.license_expiry).toLocaleDateString()}
                  icon={<FileText className="w-4 h-4" />}
                />
              )}
              {truck.insurance_expiry && (
                <InfoField
                  label="Insurance Expiry"
                  value={new Date(truck.insurance_expiry).toLocaleDateString()}
                  icon={<FileText className="w-4 h-4" />}
                />
              )}
              {truck.inspection_expiry && (
                <InfoField
                  label="Inspection Expiry"
                  value={new Date(truck.inspection_expiry).toLocaleDateString()}
                  icon={<FileText className="w-4 h-4" />}
                />
              )}
            </InfoGrid>
          </DetailSection>
        )}

        {/* Additional Information */}
        {(truck.capacity || truck.notes) && (
          <DetailSection
            title="Additional Information"
            icon={<FileText className="w-5 h-5" />}
            description="Additional vehicle details and notes"
          >
            <InfoGrid cols={2}>
              {truck.capacity && (
                <InfoField
                  label="Capacity"
                  value={truck.capacity}
                />
              )}
              {truck.notes && (
                <InfoField
                  label="Notes"
                  value={<span className="whitespace-pre-wrap">{truck.notes}</span>}
                  className="md:col-span-2"
                />
              )}
            </InfoGrid>
          </DetailSection>
        )}
      </div>
    </DetailPageLayout>
  )
}
