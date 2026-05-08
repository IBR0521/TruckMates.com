import type { AutomationLevel } from "@/lib/ai/types"

export type AutomationConfig = {
  id: string
  companyId: string
  automationType: string
  level: AutomationLevel
  enabled: boolean
  confidenceThreshold: number
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type AutomationLog = {
  id: string
  companyId: string
  automationType: string
  level: AutomationLevel
  triggered: boolean
  confidence: number
  reasoning: string
  actionTaken: string | null
  actionPayload: Record<string, unknown> | null
  approved: boolean | null
  reversedAt: string | null
  createdAt: string
}

export type PendingApproval = {
  id: string
  companyId: string
  automationType: string
  description: string
  confidence: number
  reasoning: string
  actionPayload: Record<string, unknown>
  expiresAt: string
  createdAt: string
}
