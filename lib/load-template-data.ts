/**
 * Shared helpers for load template extract / apply (repeat lanes).
 * Templates store reusable fields only — no dates, driver, or truck assignment.
 */

import type { createLoad } from "@/app/actions/loads"

export type CreateLoadPayload = Parameters<typeof createLoad>[0]

/** Mirrors add-load form shape for easy UI pre-fill */
export type LoadTemplateFormData = {
  loadType?: string
  customerId?: string
  companyName?: string
  reference?: string
  origin?: string
  destination?: string
  shipperName?: string
  shipperAddress?: string
  shipperCity?: string
  shipperState?: string
  shipperZip?: string
  shipperContact?: string
  shipperPhone?: string
  pickupInstructions?: string
  consigneeName?: string
  consigneeAddress?: string
  consigneeCity?: string
  consigneeState?: string
  consigneeZip?: string
  consigneeContact?: string
  consigneePhone?: string
  deliveryInstructions?: string
  contents?: string
  weight?: string
  pieces?: string
  pieceCount?: string
  pallets?: string
  freightClass?: string
  nmfcCode?: string
  cubeFt?: string
  widthIn?: string
  heightFt?: string
  lengthFt?: string
  isHazardous?: boolean
  unNumber?: string
  hazardClass?: string
  packingGroup?: string
  properShippingName?: string
  placardRequired?: boolean
  emergencyContact?: string
  isOversized?: boolean
  isReefer?: boolean
  estimatedMiles?: string
  haulingFee?: string
  fuelSurcharge?: string
  accessorialCharges?: string
  discount?: string
  totalRate?: string
  requiresLiftgate?: boolean
  requiresInsideDelivery?: boolean
  requiresAppointment?: boolean
  notes?: string
  specialInstructions?: string
  carrierType?: string
  deliveryType?: string
  deliveryPoints?: Array<{
    delivery_number: number
    location_name: string
    address: string
    city?: string
    state?: string
    zip?: string
    contact_name?: string
    phone?: string
    delivery_type?: string
    notes?: string
  }>
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined
}

function numStr(v: unknown): string | undefined {
  if (v == null || v === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : undefined
}

export function extractTemplateDataFromLoad(
  load: Record<string, unknown>,
): LoadTemplateFormData {
  return {
    loadType: str(load.load_type),
    customerId: str(load.customer_id),
    companyName: str(load.company_name),
    reference: str(load.customer_reference),
    origin: str(load.origin),
    destination: str(load.destination),
    shipperName: str(load.shipper_name),
    shipperAddress: str(load.shipper_address),
    shipperCity: str(load.shipper_city),
    shipperState: str(load.shipper_state),
    shipperZip: str(load.shipper_zip),
    shipperContact: str(load.shipper_contact_name),
    shipperPhone: str(load.shipper_contact_phone),
    pickupInstructions: str(load.pickup_instructions),
    consigneeName: str(load.consignee_name),
    consigneeAddress: str(load.consignee_address),
    consigneeCity: str(load.consignee_city),
    consigneeState: str(load.consignee_state),
    consigneeZip: str(load.consignee_zip),
    consigneeContact: str(load.consignee_contact_name),
    consigneePhone: str(load.consignee_contact_phone),
    deliveryInstructions: str(load.delivery_instructions),
    contents: str(load.contents),
    weight: load.weight_kg
      ? String(Number(load.weight_kg) / 1000)
      : str(load.weight),
    pieces: numStr(load.pieces),
    pieceCount: numStr(load.piece_count ?? load.pieces),
    pallets: numStr(load.pallets),
    freightClass: str(load.freight_class),
    nmfcCode: str(load.nmfc_code),
    cubeFt: numStr(load.cube_ft),
    widthIn: numStr(load.width),
    heightFt: numStr(load.height),
    lengthFt: numStr(load.length),
    isHazardous: Boolean(load.is_hazardous),
    unNumber: str(load.un_number),
    hazardClass: str(load.hazard_class),
    packingGroup: str(load.packing_group),
    properShippingName: str(load.proper_shipping_name),
    placardRequired: Boolean(load.placard_required),
    emergencyContact: str(load.emergency_contact),
    isOversized: Boolean(load.is_oversized),
    estimatedMiles: numStr(load.estimated_miles),
    haulingFee: numStr(load.rate),
    fuelSurcharge: numStr(load.fuel_surcharge),
    accessorialCharges: numStr(load.accessorial_charges),
    discount: numStr(load.discount),
    totalRate: numStr(load.total_rate),
    requiresLiftgate: Boolean(load.requires_liftgate),
    requiresInsideDelivery: Boolean(load.requires_inside_delivery),
    requiresAppointment: Boolean(load.requires_appointment),
    notes: str(load.notes),
    specialInstructions: str(load.special_instructions),
    carrierType: str(load.carrier_type),
    deliveryType: str(load.delivery_type),
  }
}

export function templateDataToCreateLoadPayload(
  data: LoadTemplateFormData,
  overrides?: Partial<CreateLoadPayload>,
): CreateLoadPayload {
  const multiStop = (data.deliveryPoints?.length ?? 0) > 0
  const payload: CreateLoadPayload = {
    shipment_number: "",
    origin: data.origin || "",
    destination: multiStop ? "Multiple Locations" : data.destination || "",
    weight: data.weight,
    contents: data.contents,
    company_name: data.companyName,
    customer_reference: data.reference,
    delivery_type: data.deliveryType || (multiStop ? "multi" : "single"),
    load_type: data.loadType,
    customer_id: data.customerId,
    carrier_type: data.carrierType,
    shipper_name: data.shipperName,
    shipper_address: data.shipperAddress,
    shipper_city: data.shipperCity,
    shipper_state: data.shipperState,
    shipper_zip: data.shipperZip,
    shipper_contact_name: data.shipperContact,
    shipper_contact_phone: data.shipperPhone,
    pickup_instructions: data.pickupInstructions,
    consignee_name: data.consigneeName,
    consignee_address: data.consigneeAddress,
    consignee_city: data.consigneeCity,
    consignee_state: data.consigneeState,
    consignee_zip: data.consigneeZip,
    consignee_contact_name: data.consigneeContact,
    consignee_contact_phone: data.consigneePhone,
    delivery_instructions: data.deliveryInstructions,
    pieces: data.pieces ? parseInt(data.pieces, 10) : undefined,
    piece_count: data.pieceCount
      ? parseInt(data.pieceCount, 10)
      : data.pieces
        ? parseInt(data.pieces, 10)
        : undefined,
    pallets: data.pallets ? parseInt(data.pallets, 10) : undefined,
    cube_ft: data.cubeFt ? parseFloat(data.cubeFt) : undefined,
    nmfc_code: data.nmfcCode,
    freight_class: data.freightClass,
    is_hazardous: data.isHazardous,
    un_number: data.unNumber,
    hazard_class: data.hazardClass,
    packing_group: data.packingGroup,
    proper_shipping_name: data.properShippingName,
    placard_required: data.placardRequired,
    emergency_contact: data.emergencyContact,
    is_oversized: data.isOversized,
    requires_liftgate: data.requiresLiftgate,
    requires_inside_delivery: data.requiresInsideDelivery,
    requires_appointment: data.requiresAppointment,
    rate: data.haulingFee ? parseFloat(data.haulingFee) : undefined,
    fuel_surcharge: data.fuelSurcharge ? parseFloat(data.fuelSurcharge) : undefined,
    accessorial_charges: data.accessorialCharges
      ? parseFloat(data.accessorialCharges)
      : undefined,
    discount: data.discount ? parseFloat(data.discount) : undefined,
    total_rate: data.totalRate ? parseFloat(data.totalRate) : undefined,
    estimated_miles: data.estimatedMiles ? parseInt(data.estimatedMiles, 10) : undefined,
    special_instructions: data.specialInstructions,
    notes: data.notes,
    status: "pending",
    ...overrides,
  }
  return payload
}

/** Map template data onto add-load form state */
export function templateDataToAddFormState(
  data: LoadTemplateFormData,
): Record<string, unknown> {
  return {
    loadType: data.loadType || "ftl",
    customerId: data.customerId || "",
    companyName: data.companyName || "",
    reference: data.reference || "",
    origin: data.origin || "",
    destination: data.destination || "",
    shipperName: data.shipperName || "",
    shipperAddress: data.shipperAddress || "",
    shipperCity: data.shipperCity || "",
    shipperState: data.shipperState || "",
    shipperZip: data.shipperZip || "",
    shipperContact: data.shipperContact || "",
    shipperPhone: data.shipperPhone || "",
    pickupInstructions: data.pickupInstructions || "",
    consigneeName: data.consigneeName || "",
    consigneeAddress: data.consigneeAddress || "",
    consigneeCity: data.consigneeCity || "",
    consigneeState: data.consigneeState || "",
    consigneeZip: data.consigneeZip || "",
    consigneeContact: data.consigneeContact || "",
    consigneePhone: data.consigneePhone || "",
    deliveryInstructions: data.deliveryInstructions || "",
    contents: data.contents || "",
    weight: data.weight || "",
    pieces: data.pieces || "",
    pieceCount: data.pieceCount || "",
    pallets: data.pallets || "",
    freightClass: data.freightClass || "",
    nmfcCode: data.nmfcCode || "",
    cubeFt: data.cubeFt || "",
    widthIn: data.widthIn || "",
    heightFt: data.heightFt || "",
    lengthFt: data.lengthFt || "",
    isHazardous: data.isHazardous ?? false,
    unNumber: data.unNumber || "",
    hazardClass: data.hazardClass || "",
    packingGroup: data.packingGroup || "",
    properShippingName: data.properShippingName || "",
    placardRequired: data.placardRequired ?? false,
    emergencyContact: data.emergencyContact || "",
    isOversized: data.isOversized ?? false,
    estimatedMiles: data.estimatedMiles || "",
    haulingFee: data.haulingFee || "",
    fuelSurcharge: data.fuelSurcharge || "",
    accessorialCharges: data.accessorialCharges || "",
    discount: data.discount || "",
    totalRate: data.totalRate || "",
    requiresLiftgate: data.requiresLiftgate ?? false,
    requiresInsideDelivery: data.requiresInsideDelivery ?? false,
    requiresAppointment: data.requiresAppointment ?? false,
    notes: data.notes || "",
    status: "pending",
    driver: "",
    truck: "",
    trailer: "",
    route: "",
    pickupDate: "",
    estimatedDelivery: "",
    pickupTime: "",
    deliveryTime: "",
  }
}
