import { redirect } from "next/navigation"

export default function MarketplaceLayout() {
  // Keep route stable but avoid Next.js notFound overlay in dev.
  redirect("/")
}

