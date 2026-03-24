import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadDocument } from "@/app/actions/documents"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { sanitizeString } from "@/lib/validation"
import { updateBOLSignature } from "@/app/actions/bol"

/**
 * Upload BOL signature from mobile app
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400 }
      )
    }

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

    // FIXED: Get user company and validate bolId belongs to it
    const result = await getCachedUserCompany(user.id)
    const company_id = result.company_id
    const companyError = result.error

    if (companyError || !company_id) {
      return NextResponse.json(
        { error: companyError || "No company found" },
        { status: 403 }
      )
    }

    // FIXED: Verify BOL belongs to user's company before signing
    const { data: bolCheck, error: bolCheckError } = await supabase
      .from("bols")
      .select("id, company_id")
      .eq("id", bolId)
      .eq("company_id", company_id)
      .single()

    if (bolCheckError || !bolCheck) {
      return NextResponse.json(
        { error: "BOL not found or does not belong to your company" },
        { status: 403 }
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

    // BUG-011 FIX: uploadDocument stores the storage path in file_url field (not a full URL)
    // Use it directly - no need to extract from URL
    const filePath = uploadResult.data.file_url
    
    if (!filePath) {
      return NextResponse.json(
        { error: "Failed to get file path from upload" },
        { status: 500 }
      )
    }
    
    // Get signed URL for the uploaded document using the path
    const { data: signedUrlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 31536000) // 1 year

    const signatureUrl = signedUrlData?.signedUrl || uploadResult.data.file_url

    // FIXED: Sanitize signedByName to prevent impersonation
    const sanitizedSignedByName = sanitizeString(signedByName, 100)
    if (!sanitizedSignedByName) {
      return NextResponse.json(
        { error: "Invalid signature name" },
        { status: 400 }
      )
    }

    // Update BOL with signature
    const updateResult = await updateBOLSignature(
      bolId,
      signatureType as "shipper" | "driver" | "consignee",
      {
      signature_url: signatureUrl,
      signed_by: sanitizedSignedByName, // FIXED: Sanitized
      signed_at: new Date().toISOString(),
    }
    )

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
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Failed to upload signature" },
      { status: 500 }
    )
  }
}



