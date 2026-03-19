import { redirect } from "next/navigation"

export default function ELDViolationsCreateRedirectPage() {
  redirect("/dashboard/eld/violations/add")
}
