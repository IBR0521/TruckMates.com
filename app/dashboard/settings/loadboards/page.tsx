import { redirect } from "next/navigation"

export default function LoadboardIntegrationsPage() {
  // Keep route stable but avoid Next.js notFound overlay in dev.
  redirect("/dashboard/settings")
}

