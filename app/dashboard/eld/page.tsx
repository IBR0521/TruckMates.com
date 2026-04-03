import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import { FleetEldPage } from "@/components/eld/fleet-eld-page"
import { DriverEldPage } from "@/components/eld/driver-eld-page"

/**
 * Same route — fleet/compliance users get the full ELD console; drivers get a mobile-style
 * HOS experience (their logs only, log grid + clocks + certify workflow).
 */
export default async function ELDPage() {
  const ctx = await getCachedAuthContext()
  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null

  if (role === "driver") {
    return <DriverEldPage />
  }

  return <FleetEldPage />
}
