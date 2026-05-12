import { FeatureLock } from "@/components/billing/feature-lock"
import { AiAssistantClient } from "./ai-assistant-client"

export default function AiAssistantPage() {
  return (
    <FeatureLock
      featureKey="ai_chat"
      title="AI Assistant"
      description="Ask TruckMates AI about your fleet, drivers, loads, finances, compliance, and maintenance. Available on Starter plans and above."
    >
      <AiAssistantClient />
    </FeatureLock>
  )
}
