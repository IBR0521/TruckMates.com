import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { generateIFTAReportPDF } from "@/app/actions/ifta-pdf"

/**
 * API route to generate and download IFTA report as PDF
 * Returns HTML that can be converted to PDF on client side
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return NextResponse.json(
      { error: result.error || "No company found" },
      { status: 403 }
    )
  }

  try {
    const pdfResult = await generateIFTAReportPDF(id)

    if (pdfResult.error) {
      return NextResponse.json(
        { error: pdfResult.error },
        { status: 400 }
      )
    }

    // Return HTML with proper headers for PDF generation
    return new NextResponse(pdfResult.html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `inline; filename="ifta-report-${id}.html"`,
      },
    })
  } catch (error: any) {
    console.error("Error generating IFTA PDF:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    )
  }
}

