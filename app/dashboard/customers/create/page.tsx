import { redirect } from "next/navigation"

export default function CustomersCreateRedirectPage() {
  redirect("/dashboard/customers/add")
}
