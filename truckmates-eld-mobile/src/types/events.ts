export type DriverEventSeverity = "info" | "warning" | "critical"

export type DriverEvent = {
  id: string
  eventType: "hos_violation" | "speeding" | "hard_brake" | "hard_accel" | "device_malfunction" | "other"
  severity: DriverEventSeverity
  title: string
  description?: string
  eventTime: string
  acknowledged: boolean
  acknowledgedAt?: string
  acknowledgmentNote?: string
  resolvedAt?: string
  resolutionNote?: string
  metadata?: Record<string, unknown>
}
