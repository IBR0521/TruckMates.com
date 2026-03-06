"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Building2, User, Truck, ArrowRight, ArrowLeft, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import {
  updateCompanyProfile,
  createFirstDriver,
  createFirstTruck,
  completeSetup,
} from "@/app/actions/account-setup"

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 5 // Removed demo data step - real users don't need it

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

  // Step 4 removed - demo data import is not needed for real users

  const [isSaving, setIsSaving] = useState(false)

  const progress = (currentStep / totalSteps) * 100

  // Helper to parse city/state/zip from a free-form address string as a fallback
  function parseCityStateZipFromAddress(address: string) {
    const result = {
      city: "",
      state: "",
      zip: "",
    }

    if (!address) return result

    const parts = address.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length < 2) return result

    // Example formats:
    // - "Chicago Ridge Mall, Oak Lawn, IL, USA"
    // - "123 Main St, Oak Lawn, IL 60453, USA"
    // - "123 Main St, London SW1A 1AA, UK"
    const countryPart = parts[parts.length - 1]
    const stateZipPart = parts[parts.length - 2]
    const cityPart =
      parts.length >= 3 ? parts[parts.length - 3] : parts[parts.length - 2]

    // Try to extract state and zip from the second-to-last part
    if (stateZipPart) {
      // US-style: "IL" or "IL 60453" or "IL 60453-1234"
      const usMatch = stateZipPart.match(
        /\b([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\b/
      )
      if (usMatch) {
        result.state = usMatch[1]
        if (usMatch[2]) {
          result.zip = usMatch[2]
        }
      } else {
        // UK/EU style postcode (e.g., "SW1A 1AA")
        const postcodeMatch = stateZipPart.match(
          /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i
        )
        if (postcodeMatch) {
          result.zip = postcodeMatch[1].toUpperCase()
        }
      }
    }

    // City: prefer the third-to-last part if it exists, otherwise use second-to-last
    if (cityPart) {
      // Avoid using pure state abbreviations or postcodes as city
      const isStateLike = /^[A-Z]{2,3}$/.test(cityPart) && !/\d/.test(cityPart)
      const isPostcodeLike =
        /\d/.test(cityPart) || /^[A-Z]{1,2}\d/.test(cityPart)
      if (!isStateLike && !isPostcodeLike) {
        result.city = cityPart
      }
    }

    return result
  }

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
      setCurrentStep(4) // Skip demo data step, go directly to completion
    } else if (currentStep === 4) {
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

            {/* Try Demo Option */}
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 bg-primary/5 mb-6">
              <div className="flex items-start gap-4">
                <Sparkles className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Want to try the demo instead?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Skip the setup and explore TruckMates with pre-loaded sample data. You can always set up your real account later.
                  </p>
                  <Button
                    onClick={() => router.push("/demo/setup")}
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Try Demo Platform
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with manual setup</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Business Address</Label>
                <GooglePlacesAutocomplete
                  value={companyProfile.business_address}
                  onChange={(value) =>
                    setCompanyProfile((prev) => ({
                      ...prev,
                      business_address: value,
                    }))
                  }
                  onPlaceSelect={(address) => {
                    console.log("[SetupWizard] Address selected:", address)
                    const addressLine1 = address.address_line1?.trim()
                    let city = address.city?.trim() || ""
                    let state = address.state?.trim() || ""
                    let zip = address.zip_code?.trim() || ""

                    // Fallback: parse from the full address string if needed
                    const rawAddress =
                      addressLine1 || companyProfile.business_address
                    if ((!city || !state || !zip) && rawAddress) {
                      const parsed = parseCityStateZipFromAddress(rawAddress)
                      city = city || parsed.city
                      state = state || parsed.state
                      zip = zip || parsed.zip
                    }

                    setCompanyProfile((prev) => ({
                      ...prev,
                      business_address: addressLine1 || prev.business_address,
                      business_city: city || prev.business_city,
                      business_state: state || prev.business_state,
                      business_zip: zip || prev.business_zip,
                    }))

                    // Show toast if we got any new data
                    if (addressLine1 || city || state || zip) {
                      toast.success("Address fields auto-filled")
                    } else {
                      console.warn(
                        "[SetupWizard] No address components parsed from Google Places or fallback parser"
                      )
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
        {[1, 2, 3, 4].map((step) => (
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
            {step < 4 && (
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
          disabled={currentStep === 1 || isSaving}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={isSaving}
        >
          {currentStep === 4 ? (
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

