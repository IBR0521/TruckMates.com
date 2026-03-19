import { redirect } from "next/navigation"

export default function MaintenanceCreateRedirectPage() {
  redirect("/dashboard/maintenance/add")
}
