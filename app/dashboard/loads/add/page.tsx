"use client"

import type React from "react"
import { errorMessage } from "@/lib/error-message"
import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import {
  ArrowLeft,
  Package,
  MapPin,
  Building2,
  Users,
  DollarSign,
  Truck,
  X,
  Plus,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createLoad } from "@/app/actions/loads"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { getTrailers } from "@/app/actions/trailers"
import { getRoutes } from "@/app/actions/routes"
import { getCustomers, createCustomer } from "@/app/actions/customers"
import { getTripPlanningEstimate } from "@/app/actions/promiles"
import { getCurrentDieselPrice, syncCurrentDieselPrice } from "@/app/actions/fuel-surcharge"
import { calculateMileage } from "@/app/actions/load-mileage"
import { getCompanySettings } from "@/app/actions/number-formats"
import { getOrderedDeliveryStopAddresses } from "@/lib/load-routing-from-stops"
import { LoadDeliveryPointsManager } from "@/components/load-delivery-points-manager"
import { createLoadDeliveryPoint } from "@/app/actions/load-delivery-points"
import { checkPermitFeasibility } from "@/app/actions/permits"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import {
  createAddressBookEntry,
  getAddressBookEntries,
  incrementAddressUsage,
  type AddressBookEntry,
} from "@/app/actions/enhanced-address-book"
import { BookOpen } from "lucide-react"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AddLoadPage() {
  const wizardSteps = [
    { key: "load-info", label: "Load Info", required: true },
    { key: "shipper", label: "Shipper", required: true },
    { key: "consignee", label: "Consignee", required: true },
    { key: "freight", label: "Freight", required: false },
    { key: "charges", label: "Charges", required: false },
    { key: "assignment", label: "Assignment", required: false },
  ] as const

  type WizardStepKey = (typeof wizardSteps)[number]["key"]

  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [trailers, setTrailers] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [deliveryPoints, setDeliveryPoints] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddShipper, setShowAddShipper] = useState(false)
  const [showAddConsignee, setShowAddConsignee] = useState(false)
  const [isCalculatingMiles, setIsCalculatingMiles] = useState(false)
  const [shipperAddressBookEntries, setShipperAddressBookEntries] = useState<AddressBookEntry[]>([])
  const [consigneeAddressBookEntries, setConsigneeAddressBookEntries] = useState<AddressBookEntry[]>([])
  const [selectedShipperAddressBookId, setSelectedShipperAddressBookId] = useState<string>("")
  const [selectedConsigneeAddressBookId, setSelectedConsigneeAddressBookId] = useState<string>("")
  const [activeStep, setActiveStep] = useState<WizardStepKey>("load-info")
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false)
  const [fuelSurchargeMode, setFuelSurchargeMode] = useState<"manual_percent" | "auto_doe">("manual_percent")
  const [manualFuelPercent, setManualFuelPercent] = useState("0")
  const [dieselPricePerGallon, setDieselPricePerGallon] = useState<number | null>(null)
  const [dieselEffectiveDate, setDieselEffectiveDate] = useState<string>("")
  const [dieselStatusNote, setDieselStatusNote] = useState<string>("")
  const [permitFeasibility, setPermitFeasibility] = useState<{ summary: string; permit_required_states: string[] } | null>(null)
  const [fscBasePrice, setFscBasePrice] = useState(1.2)
  const [fscMpgAssumed, setFscMpgAssumed] = useState(6.5)
  const milesRequestSeq = useRef(0)

  const [formData, setFormData] = useState({
    // Load Info
    shipmentNumber: "",
    autoNumbering: false,
    loadType: "ftl",
    customerType: "customer",
    customerId: "",
    companyName: "",
    reference: "",
    
    // Origin/Shipper
    shipperName: "",
    shipperAddress: "",
    shipperCity: "",
    shipperState: "",
    shipperZip: "",
    shipperContact: "",
    shipperPhone: "",
    origin: "",
    pickupDate: "",
    pickupTime: "",
    pickupInstructions: "",
    
    // Destination/Consignee
    consigneeName: "",
    consigneeAddress: "",
    consigneeCity: "",
    consigneeState: "",
    consigneeZip: "",
    consigneeContact: "",
    consigneePhone: "",
    destination: "",
    estimatedDelivery: "",
    deliveryTime: "",
    deliveryInstructions: "",
    
    // Freight
    contents: "",
    weight: "",
    pieces: "",
    pieceCount: "",
    pallets: "",
    freightClass: "",
    nmfcCode: "",
    cubeFt: "",
    widthIn: "",
    heightFt: "",
    lengthFt: "",
    isHazardous: false,
    unNumber: "",
    hazardClass: "",
    packingGroup: "",
    properShippingName: "",
    placardRequired: false,
    emergencyContact: "",
    isOversized: false,
    isReefer: false,
    
    // Route
    estimatedMiles: "",
    milesMethod: "manual",
    
    // Charges
    haulingFee: "",
    fuelSurcharge: "",
    accessorialCharges: "",
    discount: "",
    totalRate: "",
    
    // Assignment
    status: "pending",
    driver: "",
    truck: "",
    trailer: "",
    route: "",
    
    // Special Requirements
    requiresLiftgate: false,
    requiresInsideDelivery: false,
    requiresAppointment: false,
    
    notes: "",
  })

  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" })
  const [newShipper, setNewShipper] = useState({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })
  const [newConsignee, setNewConsignee] = useState({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })

  useEffect(() => {
    async function loadData() {
      const [driversResult, trucksResult, trailersResult, routesResult, customersResult, shipperAddressBookResult, consigneeAddressBookResult, settingsResult, dieselResult] = await Promise.all([
        getDrivers(),
        getTrucks(),
        getTrailers(),
        getRoutes(),
        getCustomers(),
        getAddressBookEntries({ category: "shipper", is_active: true }),
        getAddressBookEntries({ category: "receiver", is_active: true }),
        getCompanySettings(),
        getCurrentDieselPrice(),
      ])
      if (driversResult.data) setDrivers(driversResult.data)
      if (trucksResult.data) setTrucks(trucksResult.data)
      if (trailersResult.data) setTrailers(trailersResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
      if (customersResult.data) setCustomers(customersResult.data)
      if (shipperAddressBookResult.data) setShipperAddressBookEntries(shipperAddressBookResult.data)
      if (consigneeAddressBookResult.data) setConsigneeAddressBookEntries(consigneeAddressBookResult.data)
      if (settingsResult.data) {
        setFscBasePrice(Number(settingsResult.data.fsc_base_price || 1.2))
        setFscMpgAssumed(Number(settingsResult.data.fsc_mpg_assumed || 6.5))
      }
      if (dieselResult.data) {
        setDieselPricePerGallon(Number(dieselResult.data.price_per_gallon || 0))
        setDieselEffectiveDate(dieselResult.data.effective_date || "")
        setDieselStatusNote("")
      } else {
        // Auto-attempt sync so Auto (DOE index) can work without manual pre-sync.
        const sync = await syncCurrentDieselPrice()
        if (sync.data) {
          setDieselPricePerGallon(Number(sync.data.price_per_gallon || 0))
          setDieselEffectiveDate(sync.data.effective_date || "")
          setDieselStatusNote("")
        } else {
          setDieselStatusNote(sync.error || dieselResult.error || "DOE diesel price not synced yet")
        }
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        customerId: selectedCustomer.id,
        companyName: selectedCustomer.name || selectedCustomer.company_name || "",
      }))
    }
  }, [selectedCustomer])

  useEffect(() => {
    if (!formData.customerId) {
      if (selectedCustomer) setSelectedCustomer(null)
      return
    }
    if (selectedCustomer?.id === formData.customerId) return
    const matched = customers.find((c) => c.id === formData.customerId) || null
    if (matched) setSelectedCustomer(matched)
  }, [customers, formData.customerId, selectedCustomer])

  useEffect(() => {
    let cancelled = false
    async function evaluatePermitFeasibility() {
      if (!formData.isOversized) {
        setPermitFeasibility(null)
        return
      }

      const routeStates = Array.from(
        new Set(
          [
            formData.shipperState,
            formData.consigneeState,
            ...deliveryPoints.map((point: any) => point?.state || point?.delivery_state || ""),
          ]
            .map((x) => String(x || "").trim().toUpperCase())
            .filter(Boolean),
        ),
      )

      if (!routeStates.length) return
      const result = await checkPermitFeasibility({
        route_states: routeStates,
        weight_lbs: formData.weight ? Number(formData.weight) : undefined,
        width_in: formData.widthIn ? Number(formData.widthIn) : undefined,
        height_ft: formData.heightFt ? Number(formData.heightFt) : undefined,
        length_ft: formData.lengthFt ? Number(formData.lengthFt) : undefined,
      })

      if (!cancelled && result.data) {
        setPermitFeasibility({
          summary: result.data.summary,
          permit_required_states: result.data.permit_required_states,
        })
      }
    }
    evaluatePermitFeasibility()
    return () => {
      cancelled = true
    }
  }, [
    deliveryPoints,
    formData.consigneeState,
    formData.heightFt,
    formData.isOversized,
    formData.lengthFt,
    formData.shipperState,
    formData.weight,
    formData.widthIn,
  ])

  useEffect(() => {
    if (!selectedShipperAddressBookId && shipperAddressBookEntries.length > 0 && !formData.shipperName) {
      const first = shipperAddressBookEntries[0]
      if (first) {
        setSelectedShipperAddressBookId(first.id)
        setFormData((prev) => ({
          ...prev,
          shipperName: first.name || first.company_name || "",
          shipperAddress: first.address_line1 || "",
          shipperCity: first.city || "",
          shipperState: first.state || "",
          shipperZip: first.zip_code || "",
          shipperContact: first.contact_name || "",
          shipperPhone: first.phone || "",
          origin:
            first.coordinates
              ? `${first.coordinates.lat}, ${first.coordinates.lng}`
              : `${first.city}, ${first.state}`.replace(/^,\s*|,\s*$/g, ""),
        }))
      }
    }
  }, [shipperAddressBookEntries, selectedShipperAddressBookId, formData.shipperName])

  useEffect(() => {
    if (!selectedConsigneeAddressBookId && consigneeAddressBookEntries.length > 0 && !formData.consigneeName) {
      const first = consigneeAddressBookEntries[0]
      if (first) {
        setSelectedConsigneeAddressBookId(first.id)
        setFormData((prev) => ({
          ...prev,
          consigneeName: first.name || first.company_name || "",
          consigneeAddress: first.address_line1 || "",
          consigneeCity: first.city || "",
          consigneeState: first.state || "",
          consigneeZip: first.zip_code || "",
          consigneeContact: first.contact_name || "",
          consigneePhone: first.phone || "",
          destination:
            first.coordinates
              ? `${first.coordinates.lat}, ${first.coordinates.lng}`
              : `${first.city}, ${first.state}`.replace(/^,\s*|,\s*$/g, ""),
        }))
      }
    }
  }, [consigneeAddressBookEntries, selectedConsigneeAddressBookId, formData.consigneeName])

  useEffect(() => {
    const hauling = Number(formData.haulingFee || 0)
    const miles = Number(formData.estimatedMiles || 0)
    const diesel = Number(dieselPricePerGallon || 0)

    let fuel = Number(formData.fuelSurcharge || 0)
    if (fuelSurchargeMode === "manual_percent") {
      const pct = Number(manualFuelPercent || 0)
      fuel = hauling > 0 && pct > 0 ? (hauling * pct) / 100 : 0
    } else {
      const base = fscBasePrice > 0 ? fscBasePrice : 1.2
      const mpg = fscMpgAssumed > 0 ? fscMpgAssumed : 6.5
      const perMile = Math.max(diesel - base, 0) / mpg
      fuel = miles > 0 ? miles * perMile : 0
    }

    const nextFuel = Number.isFinite(fuel) ? fuel.toFixed(2) : ""
    const accessorial = Number(formData.accessorialCharges || 0)
    const discount = Number(formData.discount || 0)
    const total = hauling + Number(nextFuel || 0) + accessorial - discount
    const nextTotal = Number.isFinite(total) ? total.toFixed(2) : ""

    setFormData((prev) => {
      if (prev.fuelSurcharge === nextFuel && prev.totalRate === nextTotal) return prev
      return { ...prev, fuelSurcharge: nextFuel, totalRate: nextTotal }
    })
  }, [
    formData.haulingFee,
    formData.estimatedMiles,
    formData.fuelSurcharge,
    formData.accessorialCharges,
    formData.discount,
    fuelSurchargeMode,
    manualFuelPercent,
    dieselPricePerGallon,
    fscBasePrice,
    fscMpgAssumed,
  ])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  /** Auto-fill miles from trip planning when pickup + drop (or multi-stop chain) are set */
  useEffect(() => {
    const requestId = ++milesRequestSeq.current
    let cancelled = false
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Mileage calculation timeout")), timeoutMs)
        }),
      ])
    }

    const run = async () => {
      const origin = formData.origin?.trim()
      if (!origin) return

      const stops = getOrderedDeliveryStopAddresses(deliveryPoints)
      if (stops.length === 0 && !formData.destination?.trim()) return

      setIsCalculatingMiles(true)
      try {
        const targetDestination = stops.length > 0 ? stops[stops.length - 1] : formData.destination!.trim()
        if (!targetDestination) return

        // Fast path: Distance Matrix-based mileage for responsive UI.
        const quickMileage = await withTimeout(calculateMileage(origin, targetDestination), 7000).catch(() => null)
        if (!cancelled && milesRequestSeq.current === requestId && quickMileage?.miles != null) {
          setFormData((prev) => ({
            ...prev,
            estimatedMiles: String(Math.round(quickMileage.miles || 0)),
            milesMethod: "trip_planning",
          }))
          return
        }

        // Fallback path: richer ProMiles estimate if quick method timed out/failed.
        if (stops.length > 0) {
          const finalStop = stops[stops.length - 1]
          if (!finalStop) return
          const res = await withTimeout(getTripPlanningEstimate({
            origin,
            destination: finalStop,
            mpg: 6.5,
          }), 12000)
          if (cancelled || res.error || !res.data) return
          const milesLeg = res.data.distance_miles
          setFormData((prev) => ({
            ...prev,
            estimatedMiles: String(Math.round(milesLeg)),
            milesMethod: "trip_planning",
          }))
          return
        }

        const res = await withTimeout(getTripPlanningEstimate({
          origin,
          destination: formData.destination!.trim(),
          mpg: 6.5,
        }), 12000)
        if (cancelled || res.error || !res.data) return
        const milesSingle = res.data.distance_miles
        setFormData((prev) => ({
          ...prev,
          estimatedMiles: String(Math.round(milesSingle)),
          milesMethod: "trip_planning",
        }))
      } catch {
        /* ignore */
      } finally {
        if (!cancelled && milesRequestSeq.current === requestId) setIsCalculatingMiles(false)
      }
    }

    const t = setTimeout(() => void run(), 900)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [formData.origin, formData.destination, deliveryPoints])

  const stepErrors = useMemo<Record<WizardStepKey, string[]>>(
    () => ({
      "load-info": [
        ...(formData.autoNumbering || formData.shipmentNumber.trim() ? [] : ["Load number is required"]),
        ...(formData.customerId ? [] : ["Customer is required"]),
      ],
      shipper: [
        ...(formData.shipperName.trim() ? [] : ["Shipper name is required"]),
        ...(formData.origin.trim() ? [] : ["Pickup location is required"]),
      ],
      consignee: [
        ...(formData.consigneeName.trim() ? [] : ["Consignee name is required"]),
        ...(formData.destination.trim() ? [] : ["Drop-off location is required"]),
      ],
      freight: [],
      charges: [],
      assignment: [],
    }),
    [
      formData.autoNumbering,
      formData.shipmentNumber,
      formData.customerId,
      formData.shipperName,
      formData.origin,
      formData.consigneeName,
      formData.destination,
    ]
  )

  const currentStepIndex = wizardSteps.findIndex((step) => step.key === activeStep)
  const isFinalStep = currentStepIndex === wizardSteps.length - 1
  const currentStepHasErrors = stepErrors[activeStep].length > 0

  const goToStep = (target: WizardStepKey) => {
    setActiveStep(target)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleNextStep = () => {
    if (currentStepHasErrors) {
      toast.error(stepErrors[activeStep][0] || "Please complete required fields before continuing")
      return
    }
    const next = wizardSteps[currentStepIndex + 1]
    if (next) goToStep(next.key)
  }

  const handleBackStep = () => {
    const prev = wizardSteps[currentStepIndex - 1]
    if (prev) goToStep(prev.key)
  }

  const handleOpenCreateConfirm = () => {
    const requiredSteps = wizardSteps.filter((step) => step.required)
    const firstInvalid = requiredSteps.find((step) => stepErrors[step.key].length > 0)
    if (firstInvalid) {
      goToStep(firstInvalid.key)
      toast.error(stepErrors[firstInvalid.key][0] || "Please complete required fields")
      return
    }
    setConfirmCreateOpen(true)
  }

  const totalRateNumber = Number(formData.totalRate || 0)
  const estimatedMilesNumber = Number(formData.estimatedMiles || 0)
  const ratePerMile =
    totalRateNumber > 0 && estimatedMilesNumber > 0 ? (totalRateNumber / estimatedMilesNumber).toFixed(2) : null

  const handleSubmit = async (e?: React.FormEvent, submitAsStatus?: "draft" | "pending" | "confirmed" | "scheduled" | "in_transit") => {
    e?.preventDefault()
    setConfirmCreateOpen(false)
    setIsSubmitting(true)

    try {
      const normalize = (value: string) => value.trim().toLowerCase()
      const findExistingAddress = (
        entries: AddressBookEntry[],
        candidate: { name: string; address: string; city: string; state: string; zip: string }
      ) => {
        return entries.find((entry) => {
          const entryName = normalize(entry.name || entry.company_name || "")
          return (
            entryName === normalize(candidate.name) &&
            normalize(entry.address_line1 || "") === normalize(candidate.address) &&
            normalize(entry.city || "") === normalize(candidate.city) &&
            normalize(entry.state || "") === normalize(candidate.state) &&
            normalize(entry.zip_code || "") === normalize(candidate.zip)
          )
        })
      }

      let shipperAddressBookId = selectedShipperAddressBookId || undefined
      let consigneeAddressBookId = selectedConsigneeAddressBookId || undefined

      // Auto-save manual shipper/consignee into address book so they can be reused.
      if (!shipperAddressBookId) {
        const shipperCandidate = {
          name: formData.shipperName,
          address: formData.shipperAddress,
          city: formData.shipperCity,
          state: formData.shipperState,
          zip: formData.shipperZip,
        }
        const hasRequiredShipperFields =
          !!shipperCandidate.name.trim() &&
          !!shipperCandidate.address.trim() &&
          !!shipperCandidate.city.trim() &&
          !!shipperCandidate.state.trim() &&
          !!shipperCandidate.zip.trim()

        if (hasRequiredShipperFields) {
          const existingShipper = findExistingAddress(shipperAddressBookEntries, shipperCandidate)
          if (existingShipper) {
            shipperAddressBookId = existingShipper.id
          } else {
            const createdShipper = await createAddressBookEntry({
              name: shipperCandidate.name.trim(),
              address_line1: shipperCandidate.address.trim(),
              city: shipperCandidate.city.trim(),
              state: shipperCandidate.state.trim(),
              zip_code: shipperCandidate.zip.trim(),
              contact_name: formData.shipperContact?.trim() || undefined,
              phone: formData.shipperPhone?.trim() || undefined,
              category: "shipper",
              auto_geocode: true,
            })
            if (createdShipper.data) {
              shipperAddressBookId = createdShipper.data.id
              setShipperAddressBookEntries((prev) => [createdShipper.data as AddressBookEntry, ...prev])
              setSelectedShipperAddressBookId(createdShipper.data.id)
            }
          }
        }
      }

      if (!consigneeAddressBookId) {
        const consigneeCandidate = {
          name: formData.consigneeName,
          address: formData.consigneeAddress,
          city: formData.consigneeCity,
          state: formData.consigneeState,
          zip: formData.consigneeZip,
        }
        const hasRequiredConsigneeFields =
          !!consigneeCandidate.name.trim() &&
          !!consigneeCandidate.address.trim() &&
          !!consigneeCandidate.city.trim() &&
          !!consigneeCandidate.state.trim() &&
          !!consigneeCandidate.zip.trim()

        if (hasRequiredConsigneeFields) {
          const existingConsignee = findExistingAddress(consigneeAddressBookEntries, consigneeCandidate)
          if (existingConsignee) {
            consigneeAddressBookId = existingConsignee.id
          } else {
            const createdConsignee = await createAddressBookEntry({
              name: consigneeCandidate.name.trim(),
              address_line1: consigneeCandidate.address.trim(),
              city: consigneeCandidate.city.trim(),
              state: consigneeCandidate.state.trim(),
              zip_code: consigneeCandidate.zip.trim(),
              contact_name: formData.consigneeContact?.trim() || undefined,
              phone: formData.consigneePhone?.trim() || undefined,
              category: "receiver",
              auto_geocode: true,
            })
            if (createdConsignee.data) {
              consigneeAddressBookId = createdConsignee.data.id
              setConsigneeAddressBookEntries((prev) => [createdConsignee.data as AddressBookEntry, ...prev])
              setSelectedConsigneeAddressBookId(createdConsignee.data.id)
            }
          }
        }
      }

      const multiStop = deliveryPoints.length > 0
      const effectiveStatus = submitAsStatus || formData.status
      const payload: any = {
        shipment_number: formData.autoNumbering ? "" : formData.shipmentNumber,
      origin: formData.origin,
        destination: multiStop ? "Multiple Locations" : formData.destination,
        shipper_address_book_id: shipperAddressBookId,
        consignee_address_book_id: consigneeAddressBookId,
      weight: formData.weight || undefined,
      contents: formData.contents || undefined,
      company_name: formData.companyName || undefined,
        customer_reference: formData.reference || undefined,
        delivery_type: multiStop ? "multi" : "single",
      load_type: formData.loadType,
        customer_id: formData.customerId || selectedCustomer?.id || undefined,
      shipper_name: formData.shipperName || undefined,
      shipper_address: formData.shipperAddress || undefined,
      shipper_city: formData.shipperCity || undefined,
      shipper_state: formData.shipperState || undefined,
      shipper_zip: formData.shipperZip || undefined,
        shipper_contact_name: formData.shipperContact || undefined,
        shipper_contact_phone: formData.shipperPhone || undefined,
      consignee_name: formData.consigneeName || undefined,
      consignee_address: formData.consigneeAddress || undefined,
      consignee_city: formData.consigneeCity || undefined,
      consignee_state: formData.consigneeState || undefined,
      consignee_zip: formData.consigneeZip || undefined,
        consignee_contact_name: formData.consigneeContact || undefined,
        consignee_contact_phone: formData.consigneePhone || undefined,
        pickup_time: formData.pickupTime || undefined,
      delivery_time: formData.deliveryTime || undefined,
        pickup_instructions: formData.pickupInstructions || undefined,
      delivery_instructions: formData.deliveryInstructions || undefined,
      pieces: formData.pieces ? parseInt(formData.pieces) : undefined,
      piece_count: formData.pieceCount ? parseInt(formData.pieceCount) : (formData.pieces ? parseInt(formData.pieces) : undefined),
      pallets: formData.pallets ? parseInt(formData.pallets) : undefined,
      cube_ft: formData.cubeFt ? parseFloat(formData.cubeFt) : undefined,
      nmfc_code: formData.nmfcCode || undefined,
      freight_class: formData.freightClass || undefined,
      is_hazardous: formData.isHazardous,
      un_number: formData.unNumber || undefined,
      hazard_class: formData.hazardClass || undefined,
      packing_group: formData.packingGroup || undefined,
      proper_shipping_name: formData.properShippingName || undefined,
      placard_required: formData.placardRequired,
      emergency_contact: formData.emergencyContact || undefined,
      is_oversized: formData.isOversized,
      requires_liftgate: formData.requiresLiftgate,
      requires_inside_delivery: formData.requiresInsideDelivery,
      requires_appointment: formData.requiresAppointment,
        rate: formData.haulingFee ? parseFloat(formData.haulingFee) : undefined,
      fuel_surcharge: formData.fuelSurcharge ? parseFloat(formData.fuelSurcharge) : undefined,
      accessorial_charges: formData.accessorialCharges ? parseFloat(formData.accessorialCharges) : undefined,
      discount: formData.discount ? parseFloat(formData.discount) : undefined,
      estimated_miles: formData.estimatedMiles ? parseInt(formData.estimatedMiles) : undefined,
        driver_id: formData.driver || undefined,
        truck_id: formData.truck || undefined,
        trailer_id: formData.trailer || undefined,
        route_id: formData.route || undefined,
        status: effectiveStatus,
      notes: formData.notes || undefined,
        load_date: formData.pickupDate || undefined,
        estimated_delivery: formData.estimatedDelivery || undefined,
      }

      const result = await createLoad(payload)

      if (result.error) {
        toast.error(result.error)
        setIsSubmitting(false)
        return
      }

      if (deliveryPoints.length > 0 && result.data?.id) {
        for (const point of deliveryPoints) {
          await createLoadDeliveryPoint(result.data.id, point)
        }
        toast.success(
          effectiveStatus === "draft"
            ? `Draft saved with ${deliveryPoints.length} delivery points`
            : `Load created with ${deliveryPoints.length} delivery points`,
        )
      } else {
        toast.success(effectiveStatus === "draft" ? "Draft load saved" : "Load created successfully")
      }

    // Increment address book usage
    if (shipperAddressBookId) {
      await incrementAddressUsage(shipperAddressBookId)
    }
    if (consigneeAddressBookId) {
      await incrementAddressUsage(consigneeAddressBookId)
    }

      router.push(`/dashboard/loads/${result.data?.id || ""}`)
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to create load"))
      setIsSubmitting(false)
    }
  }

  const filteredCustomers = customers.filter(c => 
    (c.name || c.company_name || "").toLowerCase().includes((selectedCustomer?.name || "").toLowerCase())
  )

  return (
    <FormPageLayout
      title="Create Load"
      subtitle="Add a new load to your system"
      backUrl="/dashboard/loads"
      onSubmit={(e) => e.preventDefault()}
      isSubmitting={isSubmitting}
      submitLabel="Create Load"
      showDefaultSubmitBar={false}
      footerActions={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">
            Step {currentStepIndex + 1} of {wizardSteps.length}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/loads">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            {!isFinalStep ? (
              <>
                <Button type="button" variant="outline" onClick={handleBackStep} disabled={currentStepIndex === 0}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button type="button" onClick={handleNextStep}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleBackStep}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={(e) => void handleSubmit(e, "draft")}
                >
                  {isSubmitting ? "Saving..." : "Save as Draft"}
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleOpenCreateConfirm}
                >
                  {isSubmitting ? "Creating..." : "Create Load"}
                </Button>
              </>
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
                <TabsList className="grid w-full grid-cols-6 bg-card/95 backdrop-blur border border-border/60 h-auto py-1">
                  {wizardSteps.map((step) => {
                    const hasErrors = stepErrors[step.key].length > 0
                    const completed = !hasErrors && wizardSteps.findIndex((s) => s.key === step.key) < currentStepIndex
                    return (
                      <TabsTrigger key={step.key} value={step.key} className="relative text-xs md:text-sm px-2 py-2">
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

              {/* Load Information Tab */}
              <TabsContent value="load-info" className="space-y-6">
                <FormSection title="Load Information" icon={<Package className="w-5 h-5" />}>
                  <FormGrid cols={3}>
                <div>
                      <Label>Load Number *</Label>
                      <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.shipmentNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, shipmentNumber: e.target.value }))}
                          disabled={formData.autoNumbering}
                          required={!formData.autoNumbering}
                          placeholder="Auto-generated"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, autoNumbering: !prev.autoNumbering }))}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        {formData.autoNumbering ? "Manual Entry" : "Auto-generate"}
                      </button>
                </div>
                <div>
                      <Label>Load Type</Label>
                      <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="loadType" value="ftl" checked={formData.loadType === "ftl"} onChange={(e) => handleSelectChange("loadType", e.target.value)} />
                          <span className="text-sm">FTL</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="loadType" value="ltl" checked={formData.loadType === "ltl"} onChange={(e) => handleSelectChange("loadType", e.target.value)} />
                          <span className="text-sm">LTL</span>
                        </label>
                      </div>
                </div>
                <div>
                      <Label>Customer Type</Label>
                      <Select value={formData.customerType} onValueChange={(v) => handleSelectChange("customerType", v)}>
                        <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="carrier">Carrier</SelectItem>
                          <SelectItem value="broker">Broker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                    <div className="md:col-span-2">
                      <Label>Customer *</Label>
                      <div className="flex gap-2 mt-1">
                        <Select value={formData.customerId} onValueChange={(v) => {
                          const customer = customers.find(c => c.id === v)
                          setSelectedCustomer(customer || null)
                          handleSelectChange("customerId", v)
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name || c.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={() => setShowAddCustomer(!showAddCustomer)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        </div>
                      {showAddCustomer && (
                        <Card className="mt-2 p-4 border-primary/20">
                          <div className="grid md:grid-cols-2 gap-3">
                            <Input placeholder="Name *" value={newCustomer.name} onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))} />
                            <Input placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} />
                            <Input placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))} />
                            <Input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))} />
                            <Input placeholder="City" value={newCustomer.city} onChange={(e) => setNewCustomer(prev => ({ ...prev, city: e.target.value }))} />
                            <Input placeholder="State" value={newCustomer.state} onChange={(e) => setNewCustomer(prev => ({ ...prev, state: e.target.value }))} />
                            <Input placeholder="ZIP" value={newCustomer.zip} onChange={(e) => setNewCustomer(prev => ({ ...prev, zip: e.target.value }))} />
                    </div>
                          <div className="flex gap-2 mt-3">
                            <Button type="button" size="sm" onClick={async () => {
                              if (!newCustomer.name) { toast.error("Name required"); return }
                              const result = await createCustomer({ 
                                name: newCustomer.name,
                                email: newCustomer.email || undefined,
                                phone: newCustomer.phone || undefined,
                                address_line1: newCustomer.address || undefined,
                                city: newCustomer.city || undefined,
                                state: newCustomer.state || undefined,
                                zip: newCustomer.zip || undefined,
                                customer_type: formData.customerType 
                              })
                              if (result.error) {
                                toast.error(result.error)
                                return
                              }
                              if (result.data) {
                                setCustomers((prev) => [...prev, result.data])
                                setSelectedCustomer(result.data)
                                setFormData(prev => ({ ...prev, customerId: result.data.id, companyName: result.data.name || result.data.company_name || "" }))
                                setNewCustomer({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" })
                                setShowAddCustomer(false)
                                toast.success("Customer added")
                              }
                            }}>Add</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                  </div>
                        </Card>
                  )}
                </div>
                <div>
                      <Label>Reference</Label>
                      <Input name="reference" value={formData.reference} onChange={handleChange} className="mt-1" />
                </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Shipper Tab */}
              <TabsContent value="shipper" className="space-y-6">
                <FormSection title="Shipper Information" icon={<Building2 className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                <div className="md:col-span-2">
                      <Label>Select from Address Book</Label>
                      <Select 
                        value={selectedShipperAddressBookId || "none"} 
                        onValueChange={(value) => {
                          if (value === "none") {
                            setSelectedShipperAddressBookId("")
                          } else {
                            setSelectedShipperAddressBookId(value)
                            const entry = shipperAddressBookEntries.find(e => e.id === value)
                            if (entry) {
                              setFormData(prev => ({
                                ...prev,
                                shipperName: entry.name || entry.company_name || "",
                                shipperAddress: entry.address_line1 || "",
                                shipperCity: entry.city || "",
                                shipperState: entry.state || "",
                                shipperZip: entry.zip_code || "",
                                shipperContact: entry.contact_name || "",
                                shipperPhone: entry.phone || "",
                                origin: entry.coordinates 
                                  ? `${entry.coordinates.lat}, ${entry.coordinates.lng}`
                                  : `${entry.city}, ${entry.state}`.replace(/^,\s*|,\s*$/g, ''),
                                pickupInstructions: entry.custom_fields?.loading_instructions || entry.notes || prev.pickupInstructions,
                              }))
                              toast.success(`Selected ${entry.name} from address book`)
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select shipper from address book (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">+ Add new shipper manually</SelectItem>
                          {shipperAddressBookEntries.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.name} {entry.company_name ? `(${entry.company_name})` : ""} - {entry.city}, {entry.state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                </div>
                <div className="md:col-span-2">
                      <Label>Shipper *</Label>
                      <div className="flex gap-2 mt-1">
                        <Input name="shipperName" value={formData.shipperName} onChange={handleChange} placeholder="Shipper name" />
                        <Button type="button" variant="outline" size="icon" title="Add to address book" onClick={() => setShowAddShipper(!showAddShipper)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          onClick={() => window.open("/dashboard/address-book", "_blank")}
                          title="Browse address book"
                        >
                          <BookOpen className="w-4 h-4" />
                        </Button>
                </div>
                      {showAddShipper && (
                        <Card className="mt-2 p-4 border-primary/20">
                          <div className="grid md:grid-cols-2 gap-3">
                            <Input placeholder="Name *" value={newShipper.name} onChange={(e) => setNewShipper(prev => ({ ...prev, name: e.target.value }))} />
                            <div className="md:col-span-2">
                              <GooglePlacesAutocomplete
                                value={newShipper.address}
                                onChange={(value) => setNewShipper(prev => ({ ...prev, address: value }))}
                                onPlaceSelect={(address) => {
                                  setNewShipper(prev => ({
                                    ...prev,
                                    // Use parsed value if it exists, otherwise keep previous value
                                    address: address.address_line1?.trim() ?? prev.address,
                                    city: address.city?.trim() ?? prev.city,
                                    state: address.state?.trim() ?? prev.state,
                                    zip: address.zip_code?.trim() ?? prev.zip,
                                  }))
                                }}
                                placeholder="Enter shipper address (auto-fills city, state, zip)"
                                label="Address"
                              />
                            </div>
                            <Input placeholder="City" value={newShipper.city} onChange={(e) => setNewShipper(prev => ({ ...prev, city: e.target.value }))} />
                            <Input placeholder="State" value={newShipper.state} onChange={(e) => setNewShipper(prev => ({ ...prev, state: e.target.value }))} />
                            <Input placeholder="ZIP" value={newShipper.zip} onChange={(e) => setNewShipper(prev => ({ ...prev, zip: e.target.value }))} />
                            <Input placeholder="Contact" value={newShipper.contact} onChange={(e) => setNewShipper(prev => ({ ...prev, contact: e.target.value }))} />
                            <Input placeholder="Phone" value={newShipper.phone} onChange={(e) => setNewShipper(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                          <div className="flex gap-2 mt-3">
                            <Button type="button" size="sm" onClick={() => {
                              if (!newShipper.name) { toast.error("Name required"); return }
                              setFormData(prev => ({
                                ...prev,
                                shipperName: newShipper.name,
                                shipperAddress: newShipper.address,
                                shipperCity: newShipper.city,
                                shipperState: newShipper.state,
                                shipperZip: newShipper.zip,
                                shipperContact: newShipper.contact,
                                shipperPhone: newShipper.phone,
                                origin: `${newShipper.city}, ${newShipper.state}`.replace(/^,\s*|,\s*$/g, ''),
                              }))
                              setNewShipper({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })
                              setShowAddShipper(false)
                              toast.success("Shipper added")
                            }}>Add to Form</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddShipper(false)}>Cancel</Button>
                </div>
                        </Card>
                      )}
                </div>
                <div className="md:col-span-2">
                      <GooglePlacesAutocomplete
                        value={formData.origin}
                        onChange={(value) => setFormData(prev => ({ ...prev, origin: value }))}
                        onPlaceSelect={(address) => {
                          setFormData(prev => ({
                            ...prev,
                            origin: address.address_line1 
                              ? `${address.address_line1}, ${address.city || ''}, ${address.state || ''} ${address.zip_code || ''}`.trim()
                              : prev.origin,
                            // Use parsed value if it exists, otherwise keep previous value
                            shipperAddress: address.address_line1?.trim() ?? prev.shipperAddress,
                            shipperCity: address.city?.trim() ?? prev.shipperCity,
                            shipperState: address.state?.trim() ?? prev.shipperState,
                            shipperZip: address.zip_code?.trim() ?? prev.shipperZip,
                          }))
                        }}
                        placeholder="Enter pickup location (auto-fills address details)"
                        label="Pickup Location"
                        required
                        id="origin"
                      />
                </div>
                <div>
                      <Label>Pickup Date</Label>
                      <Input name="pickupDate" type="date" value={formData.pickupDate} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Pickup Time</Label>
                      <Input name="pickupTime" type="time" value={formData.pickupTime} onChange={handleChange} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                      <Label>Pickup Instructions</Label>
                      <Textarea name="pickupInstructions" value={formData.pickupInstructions} onChange={handleChange} className="mt-1" rows={2} />
                </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Consignee Tab */}
              <TabsContent value="consignee" className="space-y-6">
                <FormSection title="Consignee & delivery" icon={<MapPin className="w-5 h-5" />}>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter the primary drop-off below. For several stops, add each stop in <strong>Delivery points</strong>
                    — the load becomes multi-stop automatically.
                  </p>
                  <FormGrid cols={2}>
                <div className="md:col-span-2">
                          <Label>Select from Address Book</Label>
                          <Select 
                            value={selectedConsigneeAddressBookId || "none"} 
                            onValueChange={(value) => {
                              if (value === "none") {
                                setSelectedConsigneeAddressBookId("")
                              } else {
                                setSelectedConsigneeAddressBookId(value)
                                const entry = consigneeAddressBookEntries.find(e => e.id === value)
                                if (entry) {
                                  setFormData(prev => ({
                                    ...prev,
                                    consigneeName: entry.name || entry.company_name || "",
                                    consigneeAddress: entry.address_line1 || "",
                                    consigneeCity: entry.city || "",
                                    consigneeState: entry.state || "",
                                    consigneeZip: entry.zip_code || "",
                                    consigneeContact: entry.contact_name || "",
                                    consigneePhone: entry.phone || "",
                                    destination: entry.coordinates 
                                      ? `${entry.coordinates.lat}, ${entry.coordinates.lng}`
                                      : `${entry.city}, ${entry.state}`.replace(/^,\s*|,\s*$/g, ''),
                                    deliveryInstructions: entry.custom_fields?.loading_instructions || entry.notes || prev.deliveryInstructions,
                                  }))
                                  toast.success(`Selected ${entry.name} from address book`)
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select consignee from address book (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">+ Add new consignee manually</SelectItem>
                              {consigneeAddressBookEntries.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>
                                  {entry.name} {entry.company_name ? `(${entry.company_name})` : ""} - {entry.city}, {entry.state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                </div>
                <div className="md:col-span-2">
                          <Label>Consignee *</Label>
                          <div className="flex gap-2 mt-1">
                            <Input name="consigneeName" value={formData.consigneeName} onChange={handleChange} placeholder="Consignee name" />
                            <Button type="button" variant="outline" size="icon" title="Add to address book" onClick={() => setShowAddConsignee(!showAddConsignee)}>
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon" 
                              onClick={() => window.open("/dashboard/address-book", "_blank")}
                              title="Browse address book"
                            >
                              <BookOpen className="w-4 h-4" />
                            </Button>
                </div>
                          {showAddConsignee && (
                            <Card className="mt-2 p-4 border-primary/20">
                              <div className="grid md:grid-cols-2 gap-3">
                                <Input placeholder="Name *" value={newConsignee.name} onChange={(e) => setNewConsignee(prev => ({ ...prev, name: e.target.value }))} />
                                <div className="md:col-span-2">
                                  <GooglePlacesAutocomplete
                                    value={newConsignee.address}
                                    onChange={(value) => setNewConsignee(prev => ({ ...prev, address: value }))}
                                    onPlaceSelect={(address) => {
                                      setNewConsignee(prev => ({
                                        ...prev,
                                        // Use parsed value if it exists, otherwise keep previous value
                                        address: address.address_line1?.trim() ?? prev.address,
                                        city: address.city?.trim() ?? prev.city,
                                        state: address.state?.trim() ?? prev.state,
                                        zip: address.zip_code?.trim() ?? prev.zip,
                                      }))
                                    }}
                                    placeholder="Enter consignee address (auto-fills city, state, zip)"
                                    label="Address"
                                  />
                                </div>
                                <Input placeholder="City" value={newConsignee.city} onChange={(e) => setNewConsignee(prev => ({ ...prev, city: e.target.value }))} />
                                <Input placeholder="State" value={newConsignee.state} onChange={(e) => setNewConsignee(prev => ({ ...prev, state: e.target.value }))} />
                                <Input placeholder="ZIP" value={newConsignee.zip} onChange={(e) => setNewConsignee(prev => ({ ...prev, zip: e.target.value }))} />
                                <Input placeholder="Contact" value={newConsignee.contact} onChange={(e) => setNewConsignee(prev => ({ ...prev, contact: e.target.value }))} />
                                <Input placeholder="Phone" value={newConsignee.phone} onChange={(e) => setNewConsignee(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                              <div className="flex gap-2 mt-3">
                                <Button type="button" size="sm" onClick={() => {
                                  if (!newConsignee.name) { toast.error("Name required"); return }
                                  setFormData(prev => ({
                                    ...prev,
                                    consigneeName: newConsignee.name,
                                    consigneeAddress: newConsignee.address,
                                    consigneeCity: newConsignee.city,
                                    consigneeState: newConsignee.state,
                                    consigneeZip: newConsignee.zip,
                                    consigneeContact: newConsignee.contact,
                                    consigneePhone: newConsignee.phone,
                                    destination: `${newConsignee.city}, ${newConsignee.state}`.replace(/^,\s*|,\s*$/g, ''),
                                  }))
                                  setNewConsignee({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })
                                  setShowAddConsignee(false)
                                  toast.success("Consignee added")
                                }}>Add to Form</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => setShowAddConsignee(false)}>Cancel</Button>
                </div>
                            </Card>
                          )}
                </div>
                <div className="md:col-span-2">
                      <GooglePlacesAutocomplete
                        value={formData.destination}
                        onChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}
                        onPlaceSelect={(address) => {
                          setFormData(prev => ({
                            ...prev,
                            destination: address.address_line1 
                              ? `${address.address_line1}, ${address.city || ''}, ${address.state || ''} ${address.zip_code || ''}`.trim()
                              : prev.destination,
                            // Use parsed value if it exists, otherwise keep previous value
                            consigneeAddress: address.address_line1?.trim() ?? prev.consigneeAddress,
                            consigneeCity: address.city?.trim() ?? prev.consigneeCity,
                            consigneeState: address.state?.trim() ?? prev.consigneeState,
                            consigneeZip: address.zip_code?.trim() ?? prev.consigneeZip,
                          }))
                        }}
                        placeholder="Enter drop off location (auto-fills address details)"
                        label="Drop Off Location"
                        required
                        id="destination"
                      />
                </div>
                <div>
                          <Label>Delivery Date</Label>
                          <Input name="estimatedDelivery" type="date" value={formData.estimatedDelivery} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                          <Label>Delivery Time</Label>
                          <Input name="deliveryTime" type="time" value={formData.deliveryTime} onChange={handleChange} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                          <Label>Delivery Instructions</Label>
                          <Textarea name="deliveryInstructions" value={formData.deliveryInstructions} onChange={handleChange} className="mt-1" rows={2} />
                </div>
                      <div className="md:col-span-2 pt-4 border-t border-border/60">
                        <Card className="border-dashed border-border/70 bg-muted/15 p-4 overflow-visible">
                          <Label className="text-base">Delivery points (optional)</Label>
                          <p className="text-xs text-muted-foreground mt-1 mb-2">
                            Add ordered stops for multi-delivery loads. Leave empty for a single drop-off above.
                          </p>
                          <p className="text-xs text-primary mb-3">
                            {deliveryPoints.length > 0
                              ? `${deliveryPoints.length} stop${deliveryPoints.length > 1 ? "s" : ""} added - this will be a multi-stop load`
                              : "No additional stops yet"}
                          </p>
                          <LoadDeliveryPointsManager
                            deliveryPoints={deliveryPoints}
                            onDeliveryPointsChange={setDeliveryPoints}
                          />
                        </Card>
                      </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Freight Tab */}
              <TabsContent value="freight" className="space-y-6">
                <FormSection title="Freight Information" icon={<Package className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Input name="contents" value={formData.contents} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Weight</Label>
                      <Input name="weight" value={formData.weight} onChange={handleChange} className="mt-1" placeholder="lbs" />
                </div>
                <div>
                      <Label>Width (in)</Label>
                      <Input name="widthIn" type="number" value={formData.widthIn} onChange={handleChange} className="mt-1" placeholder='102' />
                </div>
                <div>
                      <Label>Height (ft)</Label>
                      <Input name="heightFt" type="number" value={formData.heightFt} onChange={handleChange} className="mt-1" placeholder='13.5' />
                </div>
                <div>
                      <Label>Length (ft)</Label>
                      <Input name="lengthFt" type="number" value={formData.lengthFt} onChange={handleChange} className="mt-1" placeholder='53' />
                </div>
                <div>
                      <Label>Pieces</Label>
                      <Input name="pieces" type="number" value={formData.pieces} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Pallets</Label>
                      <Input name="pallets" type="number" value={formData.pallets} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Piece Count</Label>
                      <Input name="pieceCount" type="number" value={formData.pieceCount} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Freight Class</Label>
                      <Select value={formData.freightClass} onValueChange={(v) => handleSelectChange("freightClass", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {["50","55","60","65","70","77.5","85","92.5","100","110","125","150","175","200","250","300","400","500"].map((fc) => (
                            <SelectItem key={fc} value={fc}>{fc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                </div>
                <div>
                      <Label>NMFC Code</Label>
                      <Input name="nmfcCode" value={formData.nmfcCode} onChange={handleChange} className="mt-1" placeholder="e.g. 156600" />
                </div>
                <div>
                      <Label>Cube (ft3)</Label>
                      <Input name="cubeFt" type="number" value={formData.cubeFt} onChange={handleChange} className="mt-1" />
                </div>
                    <div className="md:col-span-2 space-y-2 rounded-md border-l-4 border-blue-500/70 bg-blue-500/5 pl-4 py-3 pr-3">
                      <Label className="text-foreground">Load characteristics</Label>
                      <p className="text-xs text-muted-foreground mb-2">What’s on the truck (commodity / equipment)</p>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { key: "isHazardous", label: "HazMat", checked: formData.isHazardous },
                          { key: "isOversized", label: "Oversized", checked: formData.isOversized },
                          { key: "isReefer", label: "Reefer", checked: formData.isReefer },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({ ...prev, [item.key]: !item.checked }))
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              item.checked
                                ? "border-blue-500/70 bg-blue-500/15 text-blue-200"
                                : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                </div>
                </div>
                    {formData.isHazardous && (
                      <div className="md:col-span-2 rounded-md border border-red-500/40 bg-red-500/5 p-4">
                        <p className="text-sm font-medium text-red-200 mb-3">HAZMAT details (required for compliance)</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label>UN Number</Label>
                            <Input name="unNumber" value={formData.unNumber} onChange={handleChange} className="mt-1" placeholder="UN1203" />
                          </div>
                          <div>
                            <Label>Hazard Class</Label>
                            <Input name="hazardClass" value={formData.hazardClass} onChange={handleChange} className="mt-1" placeholder="3" />
                          </div>
                          <div>
                            <Label>Packing Group</Label>
                            <Input name="packingGroup" value={formData.packingGroup} onChange={handleChange} className="mt-1" placeholder="II" />
                          </div>
                          <div>
                            <Label>Emergency Contact</Label>
                            <Input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="mt-1" placeholder="+1..." />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Proper Shipping Name</Label>
                            <Input
                              name="properShippingName"
                              value={formData.properShippingName}
                              onChange={handleChange}
                              className="mt-1"
                              placeholder="Gasoline"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, placardRequired: !prev.placardRequired }))}
                              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                formData.placardRequired
                                  ? "border-red-500/70 bg-red-500/15 text-red-200"
                                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Placard Required
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {formData.isOversized && permitFeasibility && (
                      <div className="md:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
                        <p className="text-sm font-medium text-amber-100">Permit feasibility pre-check</p>
                        <p className="text-xs text-amber-100/80 mt-1">{permitFeasibility.summary}</p>
                        {permitFeasibility.permit_required_states.length > 0 && (
                          <p className="text-xs text-amber-100/80 mt-2">
                            Confirm permits are secured for: {permitFeasibility.permit_required_states.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="md:col-span-2 space-y-2 rounded-md border-l-4 border-amber-500/70 bg-amber-500/5 pl-4 py-3 pr-3">
                      <Label className="text-foreground">Delivery requirements</Label>
                      <p className="text-xs text-muted-foreground mb-2">What the driver must do at delivery (not freight type)</p>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { key: "requiresLiftgate", label: "Liftgate", checked: formData.requiresLiftgate },
                          { key: "requiresInsideDelivery", label: "Inside delivery", checked: formData.requiresInsideDelivery },
                          { key: "requiresAppointment", label: "Appointment", checked: formData.requiresAppointment },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({ ...prev, [item.key]: !item.checked }))
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              item.checked
                                ? "border-amber-500/70 bg-amber-500/15 text-amber-100"
                                : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Charges Tab */}
              <TabsContent value="charges" className="space-y-6">
                <FormSection title="Charges & Pricing" icon={<DollarSign className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                  <div>
                      <Label>Estimated miles</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                        Filled automatically from trip planning when pickup and drop-off (or delivery stops) are set.
                      </p>
                      <div className="flex gap-2 mt-1 items-center">
                        <Input
                          name="estimatedMiles"
                          value={formData.estimatedMiles}
                          readOnly
                          className="bg-muted/40"
                          placeholder={isCalculatingMiles ? "…" : "—"}
                        />
                        {isCalculatingMiles && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Updating…</span>
                        )}
                  </div>
              </div>
                <div>
                      <Label>Hauling Fee</Label>
                      <Input name="haulingFee" value={formData.haulingFee} onChange={handleChange} className="mt-1" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                      <Label>Fuel Surcharge</Label>
                      <Select
                        value={fuelSurchargeMode}
                        onValueChange={(v: "manual_percent" | "auto_doe") => setFuelSurchargeMode(v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual_percent">Manual %</SelectItem>
                          <SelectItem value="auto_doe">Auto (DOE index)</SelectItem>
                        </SelectContent>
                      </Select>
                      {fuelSurchargeMode === "manual_percent" ? (
                        <Input
                          value={manualFuelPercent}
                          onChange={(e) => setManualFuelPercent(e.target.value)}
                          className="mt-1"
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {dieselPricePerGallon == null
                            ? `${dieselStatusNote || "DOE diesel price not synced yet"}. Fuel surcharge stays at $0.00.`
                            : `DOE $${dieselPricePerGallon.toFixed(3)}/gal${
                                dieselEffectiveDate ? ` (${dieselEffectiveDate})` : ""
                              } • Base $${fscBasePrice.toFixed(2)} • MPG ${fscMpgAssumed.toFixed(1)}`}
                        </p>
                      )}
                      <Input
                        name="fuelSurcharge"
                        value={formData.fuelSurcharge}
                        onChange={handleChange}
                        className="mt-1 bg-muted/40"
                        placeholder="0.00"
                        readOnly
                      />
                </div>
                <div>
                      <Label>Accessorial Charges</Label>
                      <Input name="accessorialCharges" value={formData.accessorialCharges} onChange={handleChange} className="mt-1" placeholder="0.00" />
                </div>
                <div>
                      <Label>Discount</Label>
                      <Input name="discount" value={formData.discount} onChange={handleChange} className="mt-1" placeholder="0.00" />
                </div>
                <div>
                      <Label>Total Rate</Label>
                      <Input
                        name="totalRate"
                        value={formData.totalRate}
                        onChange={handleChange}
                        className="mt-1 bg-primary/10 border-primary/30 font-semibold"
                        placeholder="0.00"
                        readOnly
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Calculated automatically</p>
                      {ratePerMile && (
                        <p className="text-xs text-primary mt-1">${ratePerMile} / mile</p>
                      )}
                </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Assignment Tab */}
              <TabsContent value="assignment" className="space-y-6">
                <FormSection title="Assignment" icon={<Truck className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                <div>
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
                        <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                      <Label>Driver</Label>
                      <Select value={formData.driver} onValueChange={(v) => handleSelectChange("driver", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                          {drivers.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} - {d.hos_status || d.status || "Status unknown"}
                              {typeof d.remaining_drive_hours === "number" ? ` - ${d.remaining_drive_hours.toFixed(1)}h remaining` : ""}
                            </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                      <Label>Truck</Label>
                      <Select value={formData.truck} onValueChange={(v) => handleSelectChange("truck", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select truck" />
                    </SelectTrigger>
                    <SelectContent>
                          {trucks.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.truck_number} - {t.status === "available" ? "Available" : t.status === "in_use" ? "In Use" : t.status || "Unknown"}
                            </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                      <Label>Trailer</Label>
                      <Select value={formData.trailer} onValueChange={(v) => handleSelectChange("trailer", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select trailer" />
                    </SelectTrigger>
                    <SelectContent>
                          {trailers.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.trailer_number} - {t.status === "available" ? "Available" : t.status === "in_use" ? "In Use" : t.status || "Unknown"}
                            </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                      <Label>Route</Label>
                      <Select value={formData.route} onValueChange={(v) => handleSelectChange("route", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                          {routes.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                    <div className="md:col-span-2">
                      <Label>Notes</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                        Dispatch notes, customer-facing details, or internal reminders — one place.
                      </p>
                      <Textarea name="notes" value={formData.notes} onChange={handleChange} className="mt-1" rows={4} />
              </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>
            </Tabs>

            <Dialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Review load before creating</DialogTitle>
                  <DialogDescription>Confirm key details to avoid dispatch errors.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Customer:</span> {selectedCustomer?.name || selectedCustomer?.company_name || "Not selected"}</p>
                  <p><span className="text-muted-foreground">Route:</span> {formData.origin || "N/A"} → {formData.destination || "N/A"}</p>
                  <p><span className="text-muted-foreground">Pickup date:</span> {formData.pickupDate || "Not set"}</p>
                  <p><span className="text-muted-foreground">Rate:</span> ${formData.totalRate || "0.00"}</p>
                  <p><span className="text-muted-foreground">Driver:</span> {drivers.find((d) => d.id === formData.driver)?.name || "Unassigned"}</p>
                  <p><span className="text-muted-foreground">Truck:</span> {trucks.find((t) => t.id === formData.truck)?.truck_number || "Unassigned"}</p>
                  <p><span className="text-muted-foreground">Trailer:</span> {trailers.find((t) => t.id === formData.trailer)?.trailer_number || "Unassigned"}</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setConfirmCreateOpen(false)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Load"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

    </FormPageLayout>
  )
}
