import type { DutyStatus } from "./eld"

export type HosLogEntry = {
  id: string
  logDate: string
  status: DutyStatus
  startTime: string
  endTime?: string
  certified?: boolean
  edited?: boolean
  editReason?: string
  originalStartTime?: string
  originalEndTime?: string
  lastEditedAt?: string
  annotation?: string
  coDriverTransferTo?: string
  coDriverTransferredAt?: string
}

export type HosClocks = {
  driveMinutesLeft: number
  shiftMinutesLeft: number
  cycleMinutesLeft: number
  effectiveDriveLimitMinutes: number
  effectiveShiftLimitMinutes: number
  adverseConditionApplied: boolean
  breakDueInMinutes: number
  currentBreakProgressMinutes: number
  shortHaulEligible: boolean
  shortHaulStatus: string
  splitSleeperEligible: boolean
  splitSleeperStatus: string
}

export type HosExceptionSettings = {
  adverseDrivingEnabled: boolean
  adverseDrivingReason: string
  adverseDrivingActivatedAt?: string
}

export type HosShortHaulSession = {
  terminalName: string
  radiusMiles: number
  startedAt: string
  terminalLatitude?: number
  terminalLongitude?: number
  endedAt?: string
  returnedToTerminal?: boolean
  completionSource?: "gps" | "manual"
  completionDistanceMiles?: number
  endLatitude?: number
  endLongitude?: number
  notes?: string
}

export type HosEditAudit = {
  id: string
  entryId: string
  editedAt: string
  editorId?: string
  actionType: "edit" | "annotation" | "co_driver_transfer"
  reason: string
  before: {
    startTime: string
    endTime?: string
  }
  after: {
    startTime: string
    endTime?: string
  }
  annotation?: string
  coDriverId?: string
  prevHash?: string
  hash: string
}
