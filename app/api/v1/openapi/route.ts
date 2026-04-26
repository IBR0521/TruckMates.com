import { NextResponse } from "next/server"
import { buildOpenApiDocument } from "@/lib/api/v1/openapi"

export async function GET() {
  return NextResponse.json(buildOpenApiDocument(), { status: 200 })
}
