import { redirect } from "next/navigation"

export default function TrucksCreateRedirectPage() {
  redirect("/dashboard/trucks/add")
}
