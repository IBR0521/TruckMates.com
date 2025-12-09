import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get("session_id")

  if (!sessionId) {
    redirect("/dashboard")
  }

  // The webhook will handle subscription creation
  // This page just confirms checkout was successful
  redirect("/dashboard?subscription=success")
}

