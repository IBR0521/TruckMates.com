import { redirect } from "next/navigation"

export default function VendorsCreateRedirectPage() {
  redirect("/dashboard/vendors/add")
}
