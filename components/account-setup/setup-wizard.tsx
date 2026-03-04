"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Building2, User, Truck, Sparkles, ArrowRight, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import {
  updateCompanyProfile,
  createFirstDriver,
  createFirstTruck,
  importDemoData,
  completeSetup,
} from "@/app/actions/account-setup"

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 6

  // Step 1: Company Profile
  const [companyProfile, setCompanyProfile] = useState({
    business_address: "",
    business_city: "",
    business_state: "",
    business_zip: "",
    business_phone: "",
    business_email: "",
  })

  // Step 2: First Driver (optional)
  const [driverData, setDriverData] = useState({
    name: "",
    email: "",
    phone: "",
    license_number: "",
  })
  const [skipDriver, setSkipDriver] = useState(false)

  // Step 3: First Truck (optional)
  const [truckData, setTruckData] = useState({
    truck_number: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    vin: "",
  })
  const [skipTruck, setSkipTruck] = useState(false)

  // Step 4: Demo Data
  const [importDemo, setImportDemo] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const [isSaving, setIsSaving] = useState(false)

  const progress = (currentStep / totalSteps) * 100

  async function handleNext() {
    if (currentStep === 1) {
      // Save company profile
      setIsSaving(true)
      try {
        const result = await updateCompanyProfile(companyProfile)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Company profile saved!")
        setCurrentStep(2)
      } catch (error: any) {
        toast.error("Failed to save company profile")
      } finally {
        setIsSaving(false)
      }
    } else if (currentStep === 2) {
      // Create driver or skip
      if (!skipDriver && driverData.name) {
        setIsSaving(true)
        try {
          const result = await createFirstDriver(driverData)
          if (result.error) {
            toast.error(result.error)
            return
          }
          toast.success("Driver added!")
        } catch (error: any) {
          toast.error("Failed to create driver")
        } finally {
          setIsSaving(false)
        }
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      // Create truck or skip
      if (!skipTruck && truckData.truck_number) {
        setIsSaving(true)
        try {
          const result = await createFirstTruck(truckData)
          if (result.error) {
            toast.error(result.error)
            return
          }
          toast.success("Truck added!")
        } catch (error: any) {
          toast.error("Failed to create truck")
        } finally {
          setIsSaving(false)
        }
      }
      setCurrentStep(4)
    } else if (currentStep === 4) {
      // Import demo data or skip
      if (importDemo) {
        setIsImporting(true)
        try {
          const result = await importDemoData()
          if (result.error) {
            toast.error(result.error)
            return
          }
          toast.success("Demo data imported!")
        } catch (error: any) {
          toast.error("Failed to import demo data")
        } finally {
          setIsImporting(false)
        }
      }
      setCurrentStep(5)
    } else if (currentStep === 5) {
      // Complete setup
      setIsSaving(true)
      try {
        const result = await completeSetup()
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Setup complete! Welcome to TruckMates!")
        onComplete()
      } catch (error: any) {
        toast.error("Failed to complete setup")
      } finally {
        setIsSaving(false)
      }
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  function renderStep() {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Building2 className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Complete Company Profile</h2>
              <p className="text-muted-foreground">
                Add your business address and contact information to get started
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Business Address</Label>
                <GooglePlacesAutocomplete
                  value={companyProfile.business_address}
                  onChange={(value) => setCompanyProfile({ ...companyProfile, business_address: value })}
                  onPlaceSelect={(address) => {
                    console.log('[SetupWizard] Address selected:', address)
                    // Use the parsed values if they exist and are non-empty, otherwise keep previous values
                    const city = address.city?.trim()
                    const state = address.state?.trim()
                    const zip = address.zip_code?.trim()
                    const addressLine1 = address.address_line1?.trim()
                    
                    setCompanyProfile({
                      ...companyProfile,
                      business_address: addressLine1 || companyProfile.business_address,
                      business_city: city || companyProfile.business_city,
                      business_state: state || companyProfile.business_state,
                      business_zip: zip || companyProfile.business_zip,
                    })
                    
                    // Show toast if we got any new data
                    if (addressLine1 || city || state || zip) {
                      toast.success("Address fields auto-filled")
                    } else {
                      console.warn('[SetupWizard] No address components parsed from Google Places')
                    }
                  }}
                  placeholder="Enter business address"
                  id="business_address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input
                    value={companyProfile.business_city}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, business_city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    value={companyProfile.business_state}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, business_state: e.target.value })}
                    placeholder="State"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <Label>Zip Code</Label>
                <Input
                  value={companyProfile.business_zip}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, business_zip: e.target.value })}
                  placeholder="Zip Code"
                />
              </div>

              <div>
                <Label>Business Phone</Label>
                <Input
                  value={companyProfile.business_phone}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, business_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label>Business Email (Optional)</Label>
                <Input
                  type="email"
                  value={companyProfile.business_email}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, business_email: e.target.value })}
                  placeholder="info@company.com"
                />
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <User className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Add Your First Driver</h2>
              <p className="text-muted-foreground">
                Add a driver now or skip and add them later
              </p>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="skip-driver"
                checked={skipDriver}
                onChange={(e) => setSkipDriver(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="skip-driver" className="cursor-pointer">
                Skip this step (I'll add drivers later)
              </Label>
            </div>

            {!skipDriver && (
              <div className="space-y-4">
                <div>
                  <Label>Driver Name *</Label>
                  <Input
                    value={driverData.name}
                    onChange={(e) => setDriverData({ ...driverData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label>Email (Optional)</Label>
                  <Input
                    type="email"
                    value={driverData.email}
                    onChange={(e) => setDriverData({ ...driverData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <Label>Phone (Optional)</Label>
                  <Input
                    value={driverData.phone}
                    onChange={(e) => setDriverData({ ...driverData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <Label>License Number (Optional)</Label>
                  <Input
                    value={driverData.license_number}
                    onChange={(e) => setDriverData({ ...driverData, license_number: e.target.value })}
                    placeholder="DL123456789"
                  />
                </div>
              </div>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Truck className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Add Your First Truck</h2>
              <p className="text-muted-foreground">
                Add a truck now or skip and add them later
              </p>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="skip-truck"
                checked={skipTruck}
                onChange={(e) => setSkipTruck(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="skip-truck" className="cursor-pointer">
                Skip this step (I'll add trucks later)
              </Label>
            </div>

            {!skipTruck && (
              <div className="space-y-4">
                <div>
                  <Label>Truck Number *</Label>
                  <Input
                    value={truckData.truck_number}
                    onChange={(e) => setTruckData({ ...truckData, truck_number: e.target.value })}
                    placeholder="TRUCK-001"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Make (Optional)</Label>
                    <Input
                      value={truckData.make}
                      onChange={(e) => setTruckData({ ...truckData, make: e.target.value })}
                      placeholder="Freightliner"
                    />
                  </div>
                  <div>
                    <Label>Model (Optional)</Label>
                    <Input
                      value={truckData.model}
                      onChange={(e) => setTruckData({ ...truckData, model: e.target.value })}
                      placeholder="Cascadia"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Year (Optional)</Label>
                    <Input
                      type="number"
                      value={truckData.year}
                      onChange={(e) => setTruckData({ ...truckData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                      placeholder="2024"
                    />
                  </div>
                  <div>
                    <Label>VIN (Optional)</Label>
                    <Input
                      value={truckData.vin}
                      onChange={(e) => setTruckData({ ...truckData, vin: e.target.value })}
                      placeholder="1FTFW1ET5DFC12345"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Sparkles className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Import Demo Data?</h2>
              <p className="text-muted-foreground">
                We can add sample drivers, trucks, and loads to help you learn the platform
              </p>
            </div>

            <Card className="p-6 border-2">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="import-demo"
                  checked={importDemo}
                  onChange={(e) => setImportDemo(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="import-demo" className="cursor-pointer text-lg font-semibold">
                  Yes, import demo data
                </Label>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                This will add sample drivers, trucks, loads, and routes to your account. You can delete them later if needed.
              </p>
            </Card>

            {isImporting && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Importing demo data...</p>
              </div>
            )}
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">You're All Set!</h2>
              <p className="text-muted-foreground">
                Your TruckMates account is ready. Click below to start using the platform.
              </p>
            </div>

            <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-foreground mb-2">What's Next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Explore the dashboard to see your overview</li>
                <li>• Add more drivers and trucks from the sidebar</li>
                <li>• Create your first load to get started</li>
                <li>• Check out the Reports section for analytics</li>
              </ul>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-sm font-medium text-foreground">
            {Math.round(progress)}% Complete
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              {currentStep > step ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : currentStep === step ? (
                <Circle className="w-8 h-8 text-primary fill-primary" />
              ) : (
                <Circle className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            {step < 5 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  currentStep > step ? "bg-green-500" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-8">{renderStep()}</Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 || isSaving || isImporting}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={isSaving || isImporting}
        >
          {currentStep === 5 ? (
            "Complete Setup"
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

