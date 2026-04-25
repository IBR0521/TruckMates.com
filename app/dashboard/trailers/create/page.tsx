import { redirect } from "next/navigation"

export default function CreateTrailerRedirectPage() {
  redirect("/dashboard/trailers/add")
}
