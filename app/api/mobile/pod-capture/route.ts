import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { updateBOLPOD } from "@/app/actions/bol"
import { uploadDocument } from "@/app/actions/documents"
import { autoGenerateInvoiceOnPOD } from "@/app/actions/auto-invoice"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Upload POD (Proof of Delivery) from mobile app
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const loadId = formData.get("loadId") as string
    const bolId = formData.get("bolId") as string | null
    const receivedBy = formData.get("receivedBy") as string
    const deliveryCondition = formData.get("deliveryCondition") as string
    const notes = formData.get("notes") as string | null
    const receivedDate = formData.get("receivedDate") as string
    const photos = formData.getAll("photos") as File[]

    if (!loadId || !receivedBy || !deliveryCondition || photos.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // FIXED: Get user company and validate loadId belongs to it
    const result = await getCachedUserCompany(user.id)
    const company_id = result.company_id
    const companyError = result.error

    if (companyError || !company_id) {
      return NextResponse.json(
        { error: companyError || "No company found" },
        { status: 403 }
      )
    }

    // FIXED: Verify load belongs to user's company before updating
    const { data: loadCheck, error: loadCheckError } = await supabase
      .from("loads")
      .select("id, company_id")
      .eq("id", loadId)
      .eq("company_id", company_id)
      .single()

    if (loadCheckError || !loadCheck) {
      return NextResponse.json(
        { error: "Load not found or does not belong to your company" },
        { status: 403 }
      )
    }

    // Upload photos to Supabase Storage
    const photoUrls: string[] = []
    for (const photo of photos) {
      const uploadResult = await uploadDocument(photo, {
        name: `POD Photo - ${loadId}`,
        type: "pod_photo",
      })

      if (uploadResult.data) {
        // FIXED: Extract storage path properly from stored path (not signed URL)
        // uploadDocument now stores the path, not a signed URL
        let filePath = uploadResult.data.file_url
        
        // If it's a full URL, extract the path
        const pathMatch = filePath.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/([^?]+)/)
        if (pathMatch) {
          filePath = decodeURIComponent(pathMatch[1])
        } else if (filePath.includes('/')) {
          // If it contains slashes but no match, try to extract from end
          filePath = filePath.split('/').pop() || filePath
        }
        
        // Generate signed URL from path
        const { data: signedUrlData } = await supabase.storage
          .from("documents")
          .createSignedUrl(filePath, 31536000) // 1 year

        photoUrls.push(signedUrlData?.signedUrl || filePath)

        // Link document to load
        try {
          const { linkDocumentToRecord } = await import("@/app/actions/document-routing")
          await linkDocumentToRecord(uploadResult.data.id, "load", loadId)
        } catch (error) {
          console.error("Failed to link POD photo to load:", error)
        }
      }
    }

    // Update BOL POD if BOL ID provided
    if (bolId) {
      await updateBOLPOD(bolId, {
        pod_photos: photoUrls,
        pod_received_by: receivedBy,
        pod_received_date: receivedDate,
        pod_delivery_condition: deliveryCondition as "good" | "damaged" | "partial",
        pod_notes: notes || undefined,
      })
    }

    // Update load status to delivered
    // FIXED: Add company_id filter for defense-in-depth
    try {
      await supabase
        .from("loads")
        .update({
          status: "delivered",
          actual_delivery: receivedDate,
        })
        .eq("id", loadId)
        .eq("company_id", company_id) // FIXED: Add company_id filter
    } catch (error) {
      console.error("Failed to update load status:", error)
    }

    // Auto-generate invoice (now handled by database trigger, but keep as fallback)
    let invoiceId: string | undefined
    try {
      const invoiceResult = await autoGenerateInvoiceOnPOD(loadId)
      if (invoiceResult.data?.invoiceId) {
        invoiceId = invoiceResult.data.invoiceId
      }
    } catch (error) {
      console.error("Failed to auto-generate invoice:", error)
      // Don't fail the request if invoice generation fails
    }

    // Send POD alert notifications (database trigger also handles this, but keep as backup)
    try {
      const { createAlert } = await import("@/app/actions/alerts")
      // FIXED: Add company_id filter to load query
      const { data: load } = await supabase
        .from("loads")
        .select("shipment_number, origin, destination, company_name, consignee_name")
        .eq("id", loadId)
        .eq("company_id", company_id) // FIXED: Add company_id filter
        .single()

      if (load) {
        // Create alert for dispatchers
        await createAlert({
          title: `POD Captured - Load ${load.shipment_number || loadId.substring(0, 8)}`,
          message: `Proof of Delivery captured for load ${load.shipment_number || "N/A"} (${load.origin || "Origin"} to ${load.destination || "Destination"}). Invoice has been automatically generated.`,
          event_type: "pod_captured",
          priority: "high",
          load_id: loadId,
          metadata: {
            bol_id: bolId,
            received_by: receivedBy,
            delivery_condition: deliveryCondition,
            photo_count: photoUrls.length,
            invoice_id: invoiceId,
          },
        }).catch(() => {
          // Alert creation might fail, continue
        })
      }
    } catch (error) {
      console.error("Failed to send POD alerts:", error)
      // Don't fail the request if alerts fail
    }

    return NextResponse.json({
      success: true,
      data: {
        loadId,
        podCaptured: true,
        photoCount: photoUrls.length,
        invoiceId,
      },
    })
  } catch (error: unknown) {
    console.error("POD capture upload error:", error)
    const message = String(errorMessage(error, ""))
    if (message.toLowerCase().includes("formdata")) {
      return NextResponse.json(
        { error: "Invalid multipart form-data payload" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: errorMessage(error, "Failed to upload POD") },
      { status: 500 }
    )
  }
}

