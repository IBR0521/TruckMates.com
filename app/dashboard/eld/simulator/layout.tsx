import { redirect } from "next/navigation"

/**
 * BUG-069: ELD Simulator must not be accessible in production.
 * FMCSA compliance: simulating fake ELD data in production would violate regulations.
 */
export default function ELDSimulatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (process.env.NODE_ENV === "production") {
    redirect("/dashboard/eld")
  }
  return <>{children}</>
}
