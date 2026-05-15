import Link from "next/link"
import { GeofencesEldConsole } from "@/components/eld/geofences-eld-console"

export default function EldGeofencesPage() {
  return (
    <div>
      <div className="px-4 pt-3 text-xs text-muted-foreground">
        <Link href="/dashboard/eld" className="text-primary hover:underline">
          ← ELD
        </Link>
      </div>
      <GeofencesEldConsole />
    </div>
  )
}
