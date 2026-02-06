import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateBOLPOD } from "@/app/actions/bol"
import { uploadDocument } from "@/app/actions/documents"
import { autoGenerateInvoiceOnPOD } from "@/app/actions/auto-invoice"

/**
 * Upload POD (Proof of Delivery) from mobile app
 */
export async function POST(request: NextRequest) {
  try {
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

    // Get user company for alerts
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    // Upload photos to Supabase Storage
    const photoUrls: string[] = []
    for (const photo of photos) {
      const uploadResult = await uploadDocument(photo, {
        name: `POD Photo - ${loadId}`,
        type: "pod_photo",
      })

      if (uploadResult.data) {
        // Get signed URL
        const filePath = uploadResult.data.file_url.split("/").pop() || ""
        const { data: signedUrlData } = await supabase.storage
          .from("documents")
          .createSignedUrl(filePath, 31536000) // 1 year

        photoUrls.push(signedUrlData?.signedUrl || uploadResult.data.file_url)

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
    try {
      await supabase
        .from("loads")
        .update({
          status: "delivered",
          actual_delivery: receivedDate,
        })
        .eq("id", loadId)
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
      const { data: load } = await supabase
        .from("loads")
        .select("shipment_number, origin, destination, company_name, consignee_name")
        .eq("id", loadId)
        .single()

      if (load && userData?.company_id) {
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
  } catch (error: any) {
    console.error("POD capture upload error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload POD" },
      { status: 500 }
    )
  }
}

