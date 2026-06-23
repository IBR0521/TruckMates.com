import { describe, expect, it } from "vitest"
import { proactiveRecommendationForceConfirmation } from "@/lib/ai/briefing-staging"

describe("proactiveRecommendationForceConfirmation", () => {
  it("forces confirmation for morning briefing update_load_status only", () => {
    expect(proactiveRecommendationForceConfirmation("morning_briefing_recommendation", "update_load_status")).toBe(true)
    expect(proactiveRecommendationForceConfirmation("morning_briefing_recommendation", "send_invoice")).toBe(false)
    expect(proactiveRecommendationForceConfirmation("late_delivery_predicted", "update_load_status")).toBe(false)
  })
})
