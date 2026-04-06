import { redirect } from "next/navigation"

/** @deprecated Use /integrations — kept for old links */
export default function PartnersRedirectPage() {
  redirect("/integrations")
}
