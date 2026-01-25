import { NextResponse } from "next/server"
import { getCompanyType } from "@/app/actions/get-company-type"

export async function GET() {
  const result = await getCompanyType()
  
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }
  
  return NextResponse.json({ data: result.data })
}


