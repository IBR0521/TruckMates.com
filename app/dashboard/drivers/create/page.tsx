import { redirect } from "next/navigation"

export default function DriversCreateRedirectPage() {
  redirect("/dashboard/drivers/add")
}
