import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { removeAllDemoData } from "@/app/actions/cleanup-demo-data"
import { isDevSurfaceBlocked } from "@/lib/security/dev-only"

export async function POST(request: NextRequest) {
  if (isDevSurfaceBlocked()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const result = await removeAllDemoData()
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "All demo data removed successfully",
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, "Failed to remove demo data") },
      { status: 500 }
    )
  }
}

