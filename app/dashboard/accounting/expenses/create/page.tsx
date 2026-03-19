import { redirect } from "next/navigation"

export default function ExpensesCreateRedirectPage() {
  redirect("/dashboard/accounting/expenses/add")
}
