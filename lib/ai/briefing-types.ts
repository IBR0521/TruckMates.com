export type BriefingSuggestedTool = {
  tool_name: string
  tool_input: Record<string, unknown>
}

export type BriefingAlert = {
  severity: "critical" | "high" | "medium"
  category: "compliance" | "operations" | "financial" | "safety"
  title: string
  description: string
  action_url?: string
  metadata?: Record<string, string | number | boolean>
  suggested_tool?: BriefingSuggestedTool | null
}

export type BriefingRecommendation = {
  priority: number
  title: string
  reasoning: string
  estimated_impact: string
  action_url?: string
  suggested_tool?: BriefingSuggestedTool | null
}

export type MorningBriefing = {
  summary: string
  critical_alerts: BriefingAlert[]
  today_outlook: {
    loads_scheduled: number
    loads_in_transit: number
    drivers_available: number
    drivers_on_duty: number
    expected_revenue_today: number
    notable_events: string[]
  }
  financial_highlights: {
    unpaid_invoices_count: number
    unpaid_invoices_total: number
    invoices_due_this_week: number
    overdue_invoices_count: number
    expected_revenue_this_week: number
  }
  compliance_warnings: BriefingAlert[]
  recommendations: BriefingRecommendation[]
}
