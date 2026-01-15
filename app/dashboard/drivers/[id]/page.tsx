"use client"

import { Button } from "@/components/ui/button"
import { Phone, Mail, Truck, Calendar, User, FileText, MapPin, CreditCard } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getDriver } from "@/app/actions/drivers"
import { getTruck } from "@/app/actions/trucks"
import { toast } from "sonner"
import { 
  DetailPageLayout, 
  DetailSection, 
  InfoGrid, 
  InfoField, 
  StatusBadge 
} from "@/components/dashboard/detail-page-layout"

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [driver, setDriver] = useState<any>(null)
  const [truck, setTruck] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/drivers/add")
      return
    }
    loadDriver()
  }, [id, router])

  async function loadDriver() {
    setIsLoading(true)
    try {
      const result = await getDriver(id)
      if (result.error) {
        toast.error(result.error)
        router.push("/dashboard/drivers")
        return
      }
      setDriver(result.data)

      // Load truck if assigned
      if (result.data?.truck_id) {
        const truckResult = await getTruck(result.data.truck_id)
        if (truckResult.data) {
          setTruck(truckResult.data)
        }
      }
    } catch (error: any) {
      toast.error("Failed to load driver details")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <DetailPageLayout
        title="Loading..."
        backUrl="/dashboard/drivers"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading driver details...</p>
        </div>
      </DetailPageLayout>
    )
  }

  if (!driver) {
    return (
      <DetailPageLayout
        title="Driver Not Found"
        backUrl="/dashboard/drivers"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Driver not found.</p>
        </div>
      </DetailPageLayout>
    )
  }

  const getStatusVariant = (status: string): "success" | "default" | "info" | "warning" => {
    switch (status?.toLowerCase()) {
      case "active":
      case "on_route":
        return "success"
      case "available":
        return "info"
      case "on_break":
        return "warning"
      default:
        return "default"
    }
  }

  return (
    <DetailPageLayout
      title={driver.name || "Driver Details"}
      subtitle={driver.email || undefined}
      backUrl="/dashboard/drivers"
      editUrl={`/dashboard/drivers/${id}/edit`}
    >
      <div className="space-y-6">
        {/* Profile Information */}
        <DetailSection
          title="Profile Information"
          icon={<User className="w-5 h-5" />}
          description="Driver contact and personal details"
        >
          <InfoGrid cols={2}>
            <InfoField
              label="Full Name"
              value={driver.name || "—"}
            />
            <InfoField
              label="Status"
              value={
                <StatusBadge 
                  status={driver.status?.replace("_", " ") || "Unknown"} 
                  variant={getStatusVariant(driver.status)}
                />
              }
            />
            {driver.email && (
              <InfoField
                label="Email"
                value={
                  <a href={`mailto:${driver.email}`} className="text-primary hover:underline">
                    {driver.email}
                  </a>
                }
                icon={<Mail className="w-4 h-4" />}
              />
            )}
            {driver.phone && (
              <InfoField
                label="Phone"
                value={
                  <a href={`tel:${driver.phone}`} className="text-primary hover:underline">
                    {driver.phone}
                  </a>
                }
                icon={<Phone className="w-4 h-4" />}
              />
            )}
            {driver.driver_id && (
              <InfoField
                label="Driver ID"
                value={driver.driver_id}
              />
            )}
            {driver.employee_type && (
              <InfoField
                label="Employee Type"
                value={driver.employee_type.charAt(0).toUpperCase() + driver.employee_type.slice(1)}
              />
            )}
            {driver.date_of_birth && (
              <InfoField
                label="Date of Birth"
                value={new Date(driver.date_of_birth).toLocaleDateString()}
                icon={<Calendar className="w-4 h-4" />}
              />
            )}
            {driver.address && (
              <InfoField
                label="Address"
                value={
                  [driver.address, driver.city, driver.state, driver.zip]
                    .filter(Boolean)
                    .join(", ") || driver.address
                }
                icon={<MapPin className="w-4 h-4" />}
                className="md:col-span-2"
              />
            )}
          </InfoGrid>
        </DetailSection>

        {/* License Information */}
        <DetailSection
          title="License Information"
          icon={<FileText className="w-5 h-5" />}
          description="Commercial driver's license details"
        >
          <InfoGrid cols={2}>
            {driver.license_number && (
              <InfoField
                label="License Number"
                value={<span className="font-mono">{driver.license_number}</span>}
              />
            )}
            {driver.license_expiry && (
              <InfoField
                label="License Expiry"
                value={new Date(driver.license_expiry).toLocaleDateString()}
                icon={<Calendar className="w-4 h-4" />}
              />
            )}
            {driver.license_state && (
              <InfoField
                label="License State"
                value={driver.license_state}
              />
            )}
            {driver.license_type && (
              <InfoField
                label="CDL License Type"
                value={driver.license_type.replace("_", " ").toUpperCase().replace("CLASS", "Class")}
              />
            )}
            {driver.license_endorsements && (
              <InfoField
                label="License Endorsements"
                value={
                  <div className="flex flex-wrap gap-2">
                    {driver.license_endorsements.split(",").map((endorsement: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium">
                        {endorsement.trim()}
                      </span>
                    ))}
                  </div>
                }
                className="md:col-span-2"
              />
            )}
          </InfoGrid>
        </DetailSection>
        
        {/* Emergency Contact */}
        {(driver.emergency_contact_name || driver.emergency_contact_phone) && (
          <DetailSection
            title="Emergency Contact"
            icon={<User className="w-5 h-5" />}
            description="Emergency contact information"
          >
            <InfoGrid cols={2}>
              {driver.emergency_contact_name && (
                <InfoField
                  label="Contact Name"
                  value={driver.emergency_contact_name}
                />
              )}
              {driver.emergency_contact_phone && (
                <InfoField
                  label="Contact Phone"
                  value={
                    <a href={`tel:${driver.emergency_contact_phone}`} className="text-primary hover:underline">
                      {driver.emergency_contact_phone}
                    </a>
                  }
                  icon={<Phone className="w-4 h-4" />}
                />
              )}
              {driver.emergency_contact_relationship && (
                <InfoField
                  label="Relationship"
                  value={driver.emergency_contact_relationship}
                />
              )}
            </InfoGrid>
          </DetailSection>
        )}

        {/* Vehicle Assignment */}
        {truck && (
          <DetailSection
            title="Vehicle Assignment"
            icon={<Truck className="w-5 h-5" />}
            description="Currently assigned vehicle"
          >
            <InfoGrid cols={2}>
              <InfoField
                label="Truck Number"
                value={
                  <Link href={`/dashboard/trucks/${truck.id}`} className="text-primary hover:underline font-semibold">
                    {truck.truck_number || "—"}
                  </Link>
                }
              />
              {truck.make && truck.model && (
                <InfoField
                  label="Vehicle"
                  value={`${truck.make} ${truck.model}`}
                />
              )}
              {truck.year && (
                <InfoField
                  label="Year"
                  value={truck.year}
                />
              )}
              {truck.license_plate && (
                <InfoField
                  label="License Plate"
                  value={truck.license_plate}
                />
              )}
            </InfoGrid>
          </DetailSection>
        )}

        {/* Additional Information */}
        {(driver.pay_rate || driver.hire_date || driver.notes) && (
          <DetailSection
            title="Additional Information"
            icon={<CreditCard className="w-5 h-5" />}
            description="Employment and payment details"
          >
            <InfoGrid cols={2}>
              {driver.pay_rate && (
                <InfoField
                  label="Pay Rate"
                  value={
                    driver.pay_rate_type === "percentage" 
                      ? `${driver.pay_rate}%`
                      : `$${parseFloat(driver.pay_rate || 0).toFixed(2)}/${driver.pay_rate_type === "hourly" ? "hr" : "mile"}`
                  }
                />
              )}
              {driver.hire_date && (
                <InfoField
                  label="Hire Date"
                  value={new Date(driver.hire_date).toLocaleDateString()}
                  icon={<Calendar className="w-4 h-4" />}
                />
              )}
              {driver.notes && (
                <InfoField
                  label="Notes"
                  value={<span className="whitespace-pre-wrap">{driver.notes}</span>}
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
