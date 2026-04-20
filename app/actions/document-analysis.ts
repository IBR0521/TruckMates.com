"use server"

export interface ExtractedDriverData {
  type: "driver"
  [key: string]: unknown
}

export interface ExtractedVehicleData {
  type: "vehicle"
  [key: string]: unknown
}

export interface DeliveryPoint {
  delivery_number: number
  [key: string]: unknown
}

export interface ExtractedLoadData {
  type: "load"
  delivery_points?: DeliveryPoint[]
  [key: string]: unknown
}

export interface RouteStop {
  stop_number: number
  [key: string]: unknown
}

export interface ExtractedRouteData {
  type: "route"
  stops?: RouteStop[]
  [key: string]: unknown
}

export interface ExtractedMaintenanceData {
  type: "maintenance"
  [key: string]: unknown
}

export interface ExtractedInvoiceData {
  type: "invoice"
  [key: string]: unknown
}

export interface ExtractedExpenseData {
  type: "expense"
  [key: string]: unknown
}

export interface ExtractedRouteAndLoadData {
  type: "route_and_load"
  stops?: RouteStop[]
  delivery_points?: DeliveryPoint[]
  [key: string]: unknown
}

export type ExtractedData =
  | ExtractedDriverData
  | ExtractedVehicleData
  | ExtractedLoadData
  | ExtractedRouteData
  | ExtractedRouteAndLoadData
  | ExtractedMaintenanceData
  | ExtractedInvoiceData
  | ExtractedExpenseData

export async function analyzeDocument(fileUrl: string, fileName: string): Promise<{
  data: ExtractedData | null
  error: string | null
  warning?: string | null
}> {
  void fileUrl
  void fileName
  return {
    data: null,
    error: "Document AI analysis is temporarily disabled while AI features are being rebuilt.",
    warning: null,
  }
}

export async function analyzeDocumentFromUrl(
  fileUrl: string,
  fileName: string,
  fileSize: number,
  metadata?: {
    name?: string
    type?: string
  }
): Promise<{
  data: {
    documentId: string
    extractedData: ExtractedData | null
    fileUrl: string
    warning?: string | null
  } | null
  error: string | null
}> {
  void fileUrl
  void fileName
  void fileSize
  void metadata
  return {
    data: null,
    error: "Document AI analysis is temporarily disabled while AI features are being rebuilt.",
  }
}

export async function createRecordFromExtractedData(
  extractedData: ExtractedData
): Promise<{
  data: { id: string; type: string } | null
  error: string | null
}> {
  void extractedData
  return {
    data: null,
    error: "Creating records from AI extracted data is temporarily disabled.",
  }
}
