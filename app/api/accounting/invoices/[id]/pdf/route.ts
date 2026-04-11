import { NextResponse } from "next/server"
import { generateInvoicePdfBuffer } from "@/app/actions/invoice-pdf"
import { errorMessage } from "@/lib/error-message"

/**
 * Authenticated download of invoice PDF (for Share → Mail attachment flow).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { pdf, error } = await generateInvoicePdfBuffer(id)
    if (error || !pdf) {
      return NextResponse.json({ error: error || "Could not generate PDF" }, { status: 400 })
    }

    const safe = id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "invoice"
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${safe}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "PDF failed") }, { status: 500 })
  }
}
