import { redirect } from "next/navigation"

export default function ELDLogsCreateRedirectPage() {
  redirect("/dashboard/eld/logs/add")
}
