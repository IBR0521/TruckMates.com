"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { User, FileText, Briefcase, Phone, Check, AlertTriangle, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createDriver } from "@/app/actions/drivers"
import { useRouter } from "next/navigation"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const parseISODate = (value: string) => {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

const toISODate = (date: Date | undefined) => {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function DatePickerField({
  name,
  value,
  onChange,
  required,
  placeholder = "Select date",
}: {
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  placeholder?: string
}) {
  const selectedDate = parseISODate(value)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("mt-1 w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onChange({
              target: { name, value: toISODate(date) },
            } as React.ChangeEvent<HTMLInputElement>)
          }}
          captionLayout="dropdown"
          fromYear={1940}
          toYear={new Date().getFullYear() + 10}
          required={required}
        />
      </PopoverContent>
    </Popover>
  )
}

export default function AddDriverPage() {
  const wizardSteps = [
    { key: "personal", label: "Personal", required: true },
    { key: "license", label: "License", required: true },
    { key: "employment", label: "Employment", required: false },
    { key: "emergency", label: "Emergency", required: true },
  ] as const
  type WizardStepKey = (typeof wizardSteps)[number]["key"]

  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeStep, setActiveStep] = useState<WizardStepKey>("personal")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    driverId: "",
    employeeType: "employee",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    licenseNumber: "",
    licenseState: "",
    licenseType: "class_a",
    licenseEndorsements: [] as string[],
    licenseExpiry: "",
    medicalCertificateExpiry: "",
    status: "active",
    hireDate: "",
    payRateType: "per_mile",
    payRate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    emergencyContact2Name: "",
    emergencyContact2Phone: "",
    emergencyContact2Relationship: "",
    notes: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const firstInvalid = wizardSteps.find((step) => stepErrors[step.key].length > 0)
    if (firstInvalid) {
      goToStep(firstInvalid.key)
      toast.error(stepErrors[firstInvalid.key][0] || "Please complete required fields")
      return
    }
    setIsSubmitting(true)

    const result = await createDriver({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      driver_id: formData.driverId || undefined,
      employee_type: formData.employeeType || undefined,
      date_of_birth: formData.dateOfBirth || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      zip: formData.zip || undefined,
      license_number: formData.licenseNumber,
      license_state: formData.licenseState || undefined,
      license_type: formData.licenseType || undefined,
      license_endorsements: formData.licenseEndorsements.length > 0 ? formData.licenseEndorsements.join(",") : undefined,
      license_expiry: formData.licenseExpiry || null,
      status: formData.status,
      hire_date: formData.hireDate || undefined,
      pay_rate_type: formData.payRateType || undefined,
      pay_rate: formData.payRate ? Number.parseFloat(formData.payRate) : null,
      emergency_contact_name: formData.emergencyContactName || undefined,
      emergency_contact_phone: formData.emergencyContactPhone || undefined,
      emergency_contact_relationship: formData.emergencyContactRelationship || undefined,
      custom_fields: {
        medical_certificate_expiry: formData.medicalCertificateExpiry || null,
        emergency_contact_2_name: formData.emergencyContact2Name || null,
        emergency_contact_2_phone: formData.emergencyContact2Phone || null,
        emergency_contact_2_relationship: formData.emergencyContact2Relationship || null,
      },
      notes: formData.notes || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Driver added successfully")
      router.push("/dashboard/drivers")
    }
  }

  const usStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
  ]

  const endorsementOptions = [
    { code: "H", label: "Hazardous Materials" },
    { code: "N", label: "Tank Vehicle" },
    { code: "P", label: "Passenger" },
    { code: "S", label: "School Bus" },
    { code: "T", label: "Double/Triple Trailers" },
    { code: "X", label: "Tank + HazMat" },
    { code: "L", label: "Air Brakes Restriction" },
    { code: "E", label: "Electric Vehicle" },
  ]

  const age = useMemo(() => {
    if (!formData.dateOfBirth) return null
    const birth = new Date(formData.dateOfBirth)
    if (Number.isNaN(birth.getTime())) return null
    const today = new Date()
    let years = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--
    return years
  }, [formData.dateOfBirth])

  const stepErrors: Record<WizardStepKey, string[]> = {
    personal: [
      ...(formData.name.trim() ? [] : ["Full name is required"]),
      ...(formData.email.trim() ? [] : ["Email is required"]),
      ...(formData.phone.trim() ? [] : ["Phone number is required"]),
      ...((age !== null && age < 21) ? ["Driver must be at least 21 for interstate operations"] : []),
    ],
    license: [
      ...(formData.licenseNumber.trim() ? [] : ["License number is required"]),
      ...(formData.licenseState.trim() ? [] : ["License state is required"]),
      ...(formData.licenseExpiry.trim() ? [] : ["License expiry date is required"]),
      ...(formData.medicalCertificateExpiry.trim() ? [] : ["Medical certificate expiry date is required"]),
    ],
    employment: [],
    emergency: [
      ...(formData.emergencyContactName.trim() ? [] : ["Emergency contact name is required"]),
      ...(formData.emergencyContactPhone.trim() ? [] : ["Emergency contact phone is required"]),
    ],
  }

  const currentStepIndex = wizardSteps.findIndex((step) => step.key === activeStep)
  const isFinalStep = currentStepIndex === wizardSteps.length - 1

  const goToStep = (target: WizardStepKey) => {
    setActiveStep(target)
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

  return (
    <FormPageLayout
      title="Add Driver"
      subtitle="Add a new driver to your team"
      backUrl="/dashboard/drivers"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Create Driver"
      showDefaultSubmitBar={false}
      footerActions={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">Step {currentStepIndex + 1} of {wizardSteps.length}</div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/drivers">
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
                {isSubmitting ? "Creating..." : "Create Driver"}
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
                <TabsList className="grid w-full grid-cols-4 bg-card/95 backdrop-blur border border-border/60 h-auto py-1">
                  {wizardSteps.map((step) => {
                    const stepIndex = wizardSteps.findIndex((s) => s.key === step.key)
                    const hasErrors = stepErrors[step.key].length > 0 && stepIndex <= currentStepIndex
                    const completed = !hasErrors && stepIndex < currentStepIndex
                    return (
                      <TabsTrigger key={step.key} value={step.key} className="text-xs md:text-sm py-2">
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

              {/* Personal Information Tab */}
              <TabsContent value="personal" className="space-y-6">
                <FormSection title="Personal Information" icon={<User className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div className="md:col-span-2">
                      <Label>Full Name *</Label>
                      <Input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <Label>Driver ID</Label>
                      <Input
                        name="driverId"
                        value={formData.driverId}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="DRV-001"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Leave blank to auto-generate.</p>
                    </div>
                    <div>
                      <Label>Employee Type</Label>
                      <Select value={formData.employeeType} onValueChange={(v) => handleSelectChange("employeeType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="contractor">Contractor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Email Address *</Label>
                      <Input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="john@company.com"
                      />
                    </div>
                    <div>
                      <Label>Phone Number *</Label>
                      <Input
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label>Date of Birth</Label>
                      <DatePickerField
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        placeholder="Select date of birth"
                      />
                      <p className={`text-[11px] mt-1 ${age !== null && age < 21 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {age === null ? "Required for compliance checks." : `Age: ${age} years${age < 21 ? " - under 21 interstate warning" : ""}`}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <GooglePlacesAutocomplete
                        value={formData.address || ""}
                        onChange={(value) => setFormData({ ...formData, address: value })}
                        onPlaceSelect={(address) => {
                          setFormData(prev => ({
                            ...prev,
                            address: address.address_line1?.trim() || prev.address,
                            city: address.city?.trim() || prev.city,
                            state: address.state?.trim() || prev.state,
                            zip: address.zip_code?.trim() || prev.zip,
                          }))
                        }}
                        placeholder="Start typing — full street, city, state & ZIP are saved automatically"
                        label="Address"
                        id="address"
                      />
                    </div>
                    <p className="md:col-span-2 text-xs text-muted-foreground">
                      City, state, and ZIP are filled from the address search above (used for payroll and compliance).
                    </p>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* License Details Tab */}
              <TabsContent value="license" className="space-y-6">
                <FormSection title="License Information" icon={<FileText className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>License Number *</Label>
                      <Input
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="DL12345678"
                      />
                    </div>
                    <div>
                      <Label>License State *</Label>
                      <Select value={formData.licenseState} onValueChange={(v) => handleSelectChange("licenseState", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {usStates.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>CDL License Type *</Label>
                      <Select value={formData.licenseType} onValueChange={(v) => handleSelectChange("licenseType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="class_a">Class A</SelectItem>
                          <SelectItem value="class_b">Class B</SelectItem>
                          <SelectItem value="class_c">Class C</SelectItem>
                          <SelectItem value="non_cdl">Non-CDL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>License Expiry Date *</Label>
                      <DatePickerField
                        name="licenseExpiry"
                        value={formData.licenseExpiry}
                        onChange={handleChange}
                        required
                        placeholder="Select license expiry"
                      />
                    </div>
                    <div>
                      <Label>Medical Certificate Expiry Date *</Label>
                      <DatePickerField
                        name="medicalCertificateExpiry"
                        value={formData.medicalCertificateExpiry}
                        onChange={handleChange}
                        required
                        placeholder="Select medical certificate expiry"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>License Endorsements</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {endorsementOptions.map((endorsement) => (
                          <label
                            key={endorsement.code}
                            className="flex items-center gap-2 cursor-pointer rounded-md border border-border/70 px-3 py-2 hover:bg-muted/20"
                            title={endorsement.label}
                          >
                            <Checkbox
                              checked={formData.licenseEndorsements.includes(endorsement.code)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    licenseEndorsements: [...prev.licenseEndorsements, endorsement.code]
                                  }))
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    licenseEndorsements: prev.licenseEndorsements.filter(e => e !== endorsement.code)
                                  }))
                                }
                              }}
                            />
                            <span className="text-sm">{endorsement.code} - {endorsement.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Employment Information Tab */}
              <TabsContent value="employment" className="space-y-6">
                <FormSection title="Employment Information" icon={<Briefcase className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Status *</Label>
                      <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="on_route">On Route</SelectItem>
                          <SelectItem value="off_duty">Off Duty</SelectItem>
                          <SelectItem value="on_leave">On Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Hire Date</Label>
                      <DatePickerField
                        name="hireDate"
                        value={formData.hireDate}
                        onChange={handleChange}
                        placeholder="Select hire date"
                      />
                    </div>
                    <div>
                      <Label>Pay Rate Type</Label>
                      <Select value={formData.payRateType} onValueChange={(v) => handleSelectChange("payRateType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_mile">Per Mile</SelectItem>
                          <SelectItem value="per_hour">Per Hour</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="flat">Flat Rate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Pay Rate</Label>
                      <Input
                        name="payRate"
                        value={formData.payRate}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder=""
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Industry reference: $0.50-$0.65 per mile (varies by lane/equipment).</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        className="mt-1"
                        rows={3}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Emergency Contact Tab */}
              <TabsContent value="emergency" className="space-y-6">
                <FormSection title="Emergency Contact" icon={<Phone className="w-5 h-5" />}>
                  <p className="text-sm text-muted-foreground mb-4">
                    Required for DOT compliance and incident response.
                  </p>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Contact Name *</Label>
                      <Input
                        name="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <Label>Contact Phone *</Label>
                      <Input
                        name="emergencyContactPhone"
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Input
                        name="emergencyContactRelationship"
                        value={formData.emergencyContactRelationship}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Spouse, Parent, etc."
                      />
                    </div>
                    <div className="md:col-span-2 pt-2 border-t border-border/60">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Secondary emergency contact (optional)</p>
                    </div>
                    <div>
                      <Label>Secondary Contact Name</Label>
                      <Input
                        name="emergencyContact2Name"
                        value={formData.emergencyContact2Name}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Alex Smith"
                      />
                    </div>
                    <div>
                      <Label>Secondary Contact Phone</Label>
                      <Input
                        name="emergencyContact2Phone"
                        type="tel"
                        value={formData.emergencyContact2Phone}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="+1 (555) 222-3333"
                      />
                    </div>
                    <div>
                      <Label>Secondary Relationship</Label>
                      <Input
                        name="emergencyContact2Relationship"
                        value={formData.emergencyContact2Relationship}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Sibling, Friend, etc."
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>
            </Tabs>
    </FormPageLayout>
  )
}
