import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateBOLSignature } from "@/app/actions/bol"
import { uploadDocument } from "@/app/actions/documents"

/**
 * Upload BOL signature from mobile app
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bolId, signatureType, signatureData, signedByName, loadId } = body

    if (!bolId || !signatureType || !signatureData || !signedByName) {
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

    // Convert base64 to blob
    const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")
    const blob = new Blob([buffer], { type: "image/png" })

    // Create file from blob
    const fileName = `bol_signature_${bolId}_${signatureType}_${Date.now()}.png`
    const file = new File([blob], fileName, { type: "image/png" })

    // Upload to Supabase Storage
    const uploadResult = await uploadDocument(file, {
      name: `BOL Signature - ${signatureType}`,
      type: "bol_signature",
    })

    if (uploadResult.error || !uploadResult.data) {
      return NextResponse.json(
        { error: uploadResult.error || "Failed to upload signature" },
        { status: 500 }
      )
    }

    // Get signed URL for the uploaded document
    const { data: signedUrlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(uploadResult.data.file_url.split("/").pop() || "", 31536000) // 1 year

    const signatureUrl = signedUrlData?.signedUrl || uploadResult.data.file_url

    // Update BOL with signature
    const updateResult = await updateBOLSignature(bolId, signatureType, {
      signature_url: signatureUrl,
      signed_by: signedByName,
      signed_at: new Date().toISOString(),
    })

    if (updateResult.error) {
      return NextResponse.json(
        { error: updateResult.error },
        { status: 500 }
      )
    }

    // Link document to load if provided
    if (loadId && uploadResult.data) {
      try {
        const { linkDocumentToRecord } = await import("@/app/actions/document-routing")
        await linkDocumentToRecord(uploadResult.data.id, "load", loadId)
      } catch (error) {
        console.error("Failed to link document to load:", error)
        // Don't fail the request if linking fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        bolId: updateResult.data?.id,
        signatureType,
        signatureUrl,
      },
    })
  } catch (error: any) {
    console.error("BOL signature upload error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload signature" },
      { status: 500 }
    )
  }
}


