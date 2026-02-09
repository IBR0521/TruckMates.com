import { TruckMatesAIChat } from "@/components/truckmates-ai/chat-interface"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "TruckMates AI | TruckMates",
  description: "Your logistics expert AI assistant"
}

export default function AIPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <TruckMatesAIChat className="flex-1" />
    </div>
  )
}

