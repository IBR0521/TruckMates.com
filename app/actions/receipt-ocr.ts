"use server"

export async function extractFuelPurchaseFromReceipt(
  imageUrl: string,
  imageFile?: File
): Promise<{
  data: {
    purchase_date?: string
    state?: string
    city?: string
    station_name?: string
    gallons?: number
    price_per_gallon?: number
    total_cost?: number
    receipt_number?: string
    odometer_reading?: number
  } | null
  error: string | null
}> {
  void imageUrl
  void imageFile
  return {
    data: null,
    error: "Receipt OCR is temporarily disabled while AI features are being rebuilt.",
  }
}

export async function uploadReceiptAndExtract(imageFile: File): Promise<{
  data: {
    purchase_date?: string
    state?: string
    city?: string
    station_name?: string
    gallons?: number
    price_per_gallon?: number
    total_cost?: number
    receipt_number?: string
    odometer_reading?: number
    receipt_url?: string
  } | null
  error: string | null
}> {
  void imageFile
  return {
    data: null,
    error: "Receipt OCR is temporarily disabled while AI features are being rebuilt.",
  }
}
