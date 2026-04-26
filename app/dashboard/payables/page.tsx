import { redirect } from "next/navigation"

export default function PayablesIndexPage() {
  redirect("/dashboard/payables/vendor-invoices")
}
