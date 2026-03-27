export type DutyStatus = "off_duty" | "sleeper_berth" | "driving" | "on_duty"

export type ELDLocation = {
  timestamp: string
  latitude: number
  longitude: number
  address?: string
  speed?: number
  heading?: number
  odometer?: number
  engine_status?: "on" | "off" | "idle"
  driver_id?: string
}

export type ELDLog = {
  log_date: string
  log_type: DutyStatus
  start_time: string
  end_time?: string
  duration_minutes?: number
  location_start?: { lat: number; lng: number; address?: string }
  location_end?: { lat: number; lng: number; address?: string }
  odometer_start?: number
  odometer_end?: number
  miles_driven?: number
  engine_hours?: number
  violations?: string[]
  driver_id?: string
}

export type ELDEvent = {
  event_type: "hos_violation" | "speeding" | "hard_brake" | "hard_accel" | "device_malfunction" | "other"
  severity?: "info" | "warning" | "critical"
  title: string
  description?: string
  event_time: string
  location?: { lat: number; lng: number; address?: string }
  metadata?: Record<string, unknown>
  driver_id?: string
}

export type DvirDefect = {
  component: string
  description: string
  severity: "minor" | "major" | "critical"
  corrected?: boolean
}

export type ELDDvir = {
  truck_id?: string
  driver_id?: string
  inspection_type: "pre_trip" | "post_trip" | "on_road"
  inspection_date: string
  inspection_time?: string
  location?: string
  odometer_reading?: number
  status?: "pending" | "passed" | "failed" | "defects_corrected"
  defects_found: boolean
  safe_to_operate: boolean
  defects?: DvirDefect[]
  notes?: string
  corrective_action?: string
  driver_signature?: string
  driver_signature_date?: string
}

export type DeviceRegistrationResponse = {
  success: boolean
  device_id: string
  device: {
    id: string
    device_name: string
    device_serial_number: string
    status: string
  }
  message: string
}
