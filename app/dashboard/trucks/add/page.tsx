"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Truck, FileText, Settings, User, Banknote, ChevronLeft, ChevronRight, Check, AlertTriangle, Sparkles } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createTruck } from "@/app/actions/trucks"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { Slider } from "@/components/ui/slider"
import { UpgradeModal } from "@/components/billing/upgrade-modal"

export default function AddVehiclePage() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const wizardSteps = [
    { key: "basic", label: "Basic Info" },
    { key: "specs", label: "Specifications" },
    { key: "ownership", label: "Ownership" },
    { key: "documents", label: "Documents" },
    { key: "assignment", label: "Assignment" },
  ] as const
  type WizardStepKey = (typeof wizardSteps)[number]["key"]

  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeStep, setActiveStep] = useState<WizardStepKey>("basic")
  const [isDecodingVin, setIsDecodingVin] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    truckNumber: "",
    vehicleType: "",
    make: "",
    model: "",
    year: "",
    vin: "",
    licensePlate: "",
    serialNumber: "",
    height: "",
    grossVehicleWeight: "",
    color: "",
    payloadCapacity: "",
    axleCount: "",
    wheelbase: "",
    engineType: "",
    transmission: "",
    ownerName: "",
    ownershipType: "owned",
    lienHolder: "",
    purchaseDate: "",
    leaseExpiryDate: "",
    cost: "",
    fuelType: "diesel",
    homeDepot: "",
    status: "available",
    currentDriver: "",
    startingLocation: "",
    fuelLevel: "",
    odometerReading: "",
    registrationState: "",
    licenseExpiryDate: "",
    lastInspectionDate: "",
    nextInspectionDue: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceExpiryDate: "",
  })

  useEffect(() => {
    async function loadDrivers() {
      const result = await getDrivers()
      if (result.data) setDrivers(result.data)
    }
    loadDrivers()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  useEffect(() => {
    if (!formData.lastInspectionDate) {
      if (formData.nextInspectionDue) {
        setFormData((prev) => ({ ...prev, nextInspectionDue: "" }))
      }
      return
    }
    const inspectionDate = new Date(formData.lastInspectionDate)
    if (Number.isNaN(inspectionDate.getTime())) return
    const nextDue = new Date(inspectionDate)
    nextDue.setFullYear(nextDue.getFullYear() + 1)
    const isoNext = nextDue.toISOString().split("T")[0]
    if (isoNext !== formData.nextInspectionDue) {
      setFormData((prev) => ({ ...prev, nextInspectionDue: isoNext }))
    }
  }, [formData.lastInspectionDate, formData.nextInspectionDue])

  const stepErrors: Record<WizardStepKey, string[]> = {
    basic: [
      ...(formData.truckNumber.trim() ? [] : ["Truck number is required"]),
      ...(formData.make.trim() ? [] : ["Make is required"]),
      ...(formData.model.trim() ? [] : ["Model is required"]),
      ...(formData.vehicleType.trim() ? [] : ["Vehicle type is required"]),
    ],
    specs: [],
    ownership: [],
    documents: [],
    assignment: [],
  }

  const currentStepIndex = wizardSteps.findIndex((step) => step.key === activeStep)
  const isFinalStep = currentStepIndex === wizardSteps.length - 1

  const goToStep = (step: WizardStepKey) => {
    setActiveStep(step)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleNextStep = () => {
    if (stepErrors[activeStep].length > 0) {
      toast.error(stepErrors[activeStep][0] || "Please complete required fields")
      return
    }
    const next = wizardSteps[currentStepIndex + 1]
    if (next) goToStep(next.key)
  }

  const handleBackStep = () => {
    const prev = wizardSteps[currentStepIndex - 1]
    if (prev) goToStep(prev.key)
  }

  const decodeVin = async () => {
    const vin = formData.vin.trim().toUpperCase()
    if (!vin || vin.length < 11) {
      toast.error("Enter a valid VIN first")
      return
    }
    setIsDecodingVin(true)
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`)
      const payload = await response.json()
      const decoded = payload?.Results?.[0]
      if (!decoded) {
        toast.error("Could not decode VIN")
        return
      }

      const normalizedBodyClass = String(decoded.BodyClass || "").toLowerCase()
      const inferredVehicleType = normalizedBodyClass.includes("truck")
        ? "box_truck"
        : normalizedBodyClass.includes("tractor")
          ? "semi"
          : normalizedBodyClass.includes("trailer")
            ? "flatbed"
            : formData.vehicleType

      setFormData((prev) => ({
        ...prev,
        vin,
        make: decoded.Make || prev.make,
        model: decoded.Model || prev.model,
        year: decoded.ModelYear || prev.year,
        vehicleType: inferredVehicleType || prev.vehicleType,
        grossVehicleWeight:
          decoded.GVWR?.match(/\d+/)?.[0] && !prev.grossVehicleWeight
            ? decoded.GVWR.match(/\d+/)?.[0]
            : prev.grossVehicleWeight,
      }))

      toast.success("VIN decoded. Review and confirm auto-filled fields.")
    } catch (error) {
      console.error(error)
      toast.error("VIN decode failed. Please fill fields manually.")
    } finally {
      setIsDecodingVin(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const firstInvalid = wizardSteps.find((step) => stepErrors[step.key].length > 0)
    if (firstInvalid) {
      goToStep(firstInvalid.key)
      toast.error(stepErrors[firstInvalid.key][0] || "Please complete required fields")
      return
    }

    const extraMetadata = {
      vehicle_type: formData.vehicleType || null,
      payload_capacity_lbs: formData.payloadCapacity || null,
      axle_count: formData.axleCount || null,
      wheelbase: formData.wheelbase || null,
      engine_type: formData.engineType || null,
      transmission: formData.transmission || null,
      ownership_type: formData.ownershipType || null,
      lien_holder: formData.lienHolder || null,
      purchase_date: formData.purchaseDate || null,
      lease_expiry_date: formData.leaseExpiryDate || null,
      registration_state: formData.registrationState || null,
      next_inspection_due: formData.nextInspectionDue || null,
      home_depot: formData.homeDepot || null,
    }

    const hasExtraMetadata = Object.values(extraMetadata).some(Boolean)

    setIsSubmitting(true)

    const result = await createTruck({
      truck_number: formData.truckNumber,
      make: formData.make,
      model: formData.model,
      year: formData.year ? parseInt(formData.year) : undefined,
      vin: formData.vin,
      license_plate: formData.licensePlate,
      serial_number: formData.serialNumber || undefined,
      height: formData.height || undefined,
      gross_vehicle_weight: formData.grossVehicleWeight ? parseInt(formData.grossVehicleWeight) : undefined,
      color: formData.color || undefined,
      owner_name: formData.ownerName || undefined,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      fuel_type: formData.fuelType || undefined,
      status: formData.status,
      current_driver_id: formData.currentDriver || null,
      current_location: formData.startingLocation || null,
      fuel_level: formData.fuelLevel ? parseInt(formData.fuelLevel) : null,
      mileage: formData.odometerReading ? parseInt(formData.odometerReading) : null,
      license_expiry_date: formData.licenseExpiryDate || undefined,
      inspection_date: formData.lastInspectionDate || undefined,
      insurance_provider: formData.insuranceProvider || undefined,
      insurance_policy_number: formData.insurancePolicyNumber || undefined,
      insurance_expiry_date: formData.insuranceExpiryDate || undefined,
      documents: hasExtraMetadata
        ? [
            {
              type: "vehicle_profile_metadata",
              data: extraMetadata,
              created_at: new Date().toISOString(),
            },
          ]
        : undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      if ((result as any)?.upgrade?.required) {
        setShowUpgradeModal(true)
      }
      toast.error(result.error)
    } else {
      toast.success("Vehicle added successfully")
      router.push("/dashboard/trucks")
    }
  }

  return (
    <>
    <FormPageLayout
      title="Add Vehicle"
      subtitle="Add a new vehicle to your fleet"
      backUrl="/dashboard/trucks"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Add Vehicle"
      showDefaultSubmitBar={false}
      footerActions={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">Step {currentStepIndex + 1} of {wizardSteps.length}</div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/trucks">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="button" variant="outline" onClick={handleBackStep} disabled={currentStepIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {!isFinalStep ? (
              <Button type="button" onClick={handleNextStep}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Vehicle"}
              </Button>
            )}
          </div>
        </div>
      }
    >
            <Tabs value={activeStep} onValueChange={(value) => goToStep(value as WizardStepKey)} className="space-y-6">
              <div className="sticky top-[108px] z-20 space-y-3">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${((currentStepIndex + 1) / wizardSteps.length) * 100}%` }}
                  />
                </div>
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-1 h-auto bg-card/95 backdrop-blur border border-border/60 p-1">
                  {wizardSteps.map((step) => {
                    const stepIndex = wizardSteps.findIndex((item) => item.key === step.key)
                    const hasErrors = stepErrors[step.key].length > 0 && stepIndex <= currentStepIndex
                    const completed = !hasErrors && stepIndex < currentStepIndex
                    return (
                      <TabsTrigger key={step.key} value={step.key} className="text-xs sm:text-sm py-2">
                        <span className="inline-flex items-center gap-1.5">
                          {completed ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : hasErrors ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-border/80 inline-block" />
                          )}
                          {step.label}
                        </span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-6">
                <FormSection title="Basic Information" icon={<Truck className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Truck Number *</Label>
                      <Input
                        name="truckNumber"
                        value={formData.truckNumber}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="TR-001"
                      />
                    </div>
                    <div>
                      <Label>VIN Number</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          name="vin"
                          value={formData.vin}
                          onChange={handleChange}
                          placeholder="1HGBH41JXMN109186"
                        />
                        <Button type="button" variant="outline" onClick={decodeVin} disabled={isDecodingVin || !formData.vin.trim()}>
                          <Sparkles className="w-4 h-4 mr-2" />
                          {isDecodingVin ? "Decoding..." : "Decode VIN"}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Vehicle Type *</Label>
                      <Select value={formData.vehicleType} onValueChange={(v) => handleSelectChange("vehicleType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semi">Semi / Tractor</SelectItem>
                          <SelectItem value="box_truck">Box Truck</SelectItem>
                          <SelectItem value="flatbed">Flatbed</SelectItem>
                          <SelectItem value="reefer">Reefer</SelectItem>
                          <SelectItem value="tanker">Tanker</SelectItem>
                          <SelectItem value="car_hauler">Car Hauler</SelectItem>
                          <SelectItem value="straight_truck">Straight Truck</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Make *</Label>
                      <Input
                        name="make"
                        value={formData.make}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="Volvo"
                      />
                    </div>
                    <div>
                      <Label>Model *</Label>
                      <Input
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="FH16"
                      />
                    </div>
                    <div>
                      <Label>Year</Label>
                      <Input
                        name="year"
                        type="number"
                        value={formData.year}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="2021"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                      />
                    </div>
                    <div>
                      <Label>License Plate</Label>
                      <Input
                        name="licensePlate"
                        value={formData.licensePlate}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="ABC-1234"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Specifications — equipment only (dispatcher-friendly) */}
              <TabsContent value="specs" className="space-y-6">
                <FormSection title="Specifications" icon={<Settings className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Serial Number</Label>
                      <Input
                        name="serialNumber"
                        value={formData.serialNumber}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="SN123456789"
                      />
                    </div>
                    <div>
                      <Label>Height</Label>
                      <Input
                        name="height"
                        value={formData.height}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="13'6&quot;"
                      />
                    </div>
                    <div>
                      <Label>Gross Vehicle Weight (lbs)</Label>
                      <Input
                        name="grossVehicleWeight"
                        type="number"
                        value={formData.grossVehicleWeight}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="80000"
                      />
                    </div>
                    <div>
                      <Label>Payload Capacity (lbs)</Label>
                      <Input
                        name="payloadCapacity"
                        type="number"
                        value={formData.payloadCapacity}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="45000"
                      />
                    </div>
                    <div>
                      <Label>Number of Axles</Label>
                      <Input
                        name="axleCount"
                        type="number"
                        value={formData.axleCount}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <Label>Wheelbase</Label>
                      <Input
                        name="wheelbase"
                        value={formData.wheelbase}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="228 in"
                      />
                    </div>
                    <div>
                      <Label>Engine Type</Label>
                      <Input
                        name="engineType"
                        value={formData.engineType}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Cummins X15"
                      />
                    </div>
                    <div>
                      <Label>Transmission</Label>
                      <Input
                        name="transmission"
                        value={formData.transmission}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="12-speed automated"
                      />
                    </div>
                    <div>
                      <Label>Fuel Type</Label>
                      <Select value={formData.fuelType} onValueChange={(v) => handleSelectChange("fuelType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="gasoline">Gasoline</SelectItem>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="cng">CNG (Compressed Natural Gas)</SelectItem>
                          <SelectItem value="lng">LNG (Liquefied Natural Gas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Input
                        name="color"
                        value={formData.color}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="White"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              <TabsContent value="ownership" className="space-y-6">
                <FormSection title="Ownership & accounting" icon={<Banknote className="w-5 h-5" />}>
                  <p className="text-sm text-muted-foreground mb-4">
                    Optional — for title, leases, or asset tracking. Not needed for day-to-day dispatch.
                  </p>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Ownership Type</Label>
                      <Select value={formData.ownershipType} onValueChange={(v) => handleSelectChange("ownershipType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owned">Owned</SelectItem>
                          <SelectItem value="leased">Leased</SelectItem>
                          <SelectItem value="financed">Financed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Registered owner</Label>
                      <Input
                        name="ownerName"
                        value={formData.ownerName}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Legal owner name"
                      />
                    </div>
                    <div>
                      <Label>Purchase / book value ($)</Label>
                      <Input
                        name="cost"
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="150000.00"
                      />
                    </div>
                    <div>
                      <Label>Lien holder</Label>
                      <Input
                        name="lienHolder"
                        value={formData.lienHolder}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Bank or lender name"
                      />
                    </div>
                    <div>
                      <Label>Purchase date</Label>
                      <Input
                        name="purchaseDate"
                        type="date"
                        value={formData.purchaseDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Lease expiration date</Label>
                      <Input
                        name="leaseExpiryDate"
                        type="date"
                        value={formData.leaseExpiryDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-6">
                <FormSection title="Documents & Insurance" icon={<FileText className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Registration Expiry Date</Label>
                      <Input
                        name="licenseExpiryDate"
                        type="date"
                        value={formData.licenseExpiryDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Registration State</Label>
                      <Input
                        name="registrationState"
                        value={formData.registrationState}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="NY"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label>Last Annual Inspection Date</Label>
                      <Input
                        name="lastInspectionDate"
                        type="date"
                        value={formData.lastInspectionDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Next Inspection Due</Label>
                      <Input
                        name="nextInspectionDue"
                        type="date"
                        value={formData.nextInspectionDue}
                        readOnly
                        className="mt-1 text-muted-foreground"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">Auto-calculated 12 months after last annual inspection.</p>
                    </div>
                    <div>
                      <Label>Insurance Provider</Label>
                      <Input
                        name="insuranceProvider"
                        value={formData.insuranceProvider}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="ABC Insurance Company"
                      />
                    </div>
                    <div>
                      <Label>Policy Number</Label>
                      <Input
                        name="insurancePolicyNumber"
                        value={formData.insurancePolicyNumber}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="POL-123456"
                      />
                    </div>
                    <div>
                      <Label>Insurance Expiry Date</Label>
                      <Input
                        name="insuranceExpiryDate"
                        type="date"
                        value={formData.insuranceExpiryDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Assignment Tab */}
              <TabsContent value="assignment" className="space-y-6">
                <FormSection title="Assignment" icon={<User className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Status *</Label>
                      <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="in_use">In Use</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="out_of_service">Out of Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Current Driver</Label>
                      <Select value={formData.currentDriver || "none"} onValueChange={(v) => handleSelectChange("currentDriver", v === "none" ? "" : v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {drivers.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Starting Location</Label>
                      <Input
                        name="startingLocation"
                        value={formData.startingLocation}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Used until GPS/telematics starts reporting"
                      />
                    </div>
                    <div>
                      <Label>Fuel Level ({formData.fuelLevel || 0}%)</Label>
                      <div className="mt-3 space-y-2">
                        <Slider
                          value={[Number(formData.fuelLevel || 0)]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, fuelLevel: String(value[0] ?? 0) }))}
                        />
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Number(formData.fuelLevel || 0)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Odometer (miles)</Label>
                      <Input
                        name="odometerReading"
                        type="number"
                        value={formData.odometerReading}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="125000"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Home Depot / Base Location</Label>
                      <Input
                        name="homeDepot"
                        value={formData.homeDepot}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Primary yard or base terminal"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>
            </Tabs>
    </FormPageLayout>
    <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature="vehicles_limit" />
    </>
  )
}
