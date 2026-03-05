import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadDocument } from "@/app/actions/documents"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { sanitizeString } from "@/lib/validation"
import * as bolActions from "@/app/actions/bol"

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

    // HIGH FIX 4: Extract full storage path correctly (not just filename)
    let filePath = uploadResult.data.file_url
    // Try to extract path from Supabase Storage URL format
    const pathMatch = filePath.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/([^?]+)/)
    if (pathMatch) {
      filePath = decodeURIComponent(pathMatch[1])
    } else {
      // If URL format doesn't match, try extracting from path after /documents/
      const documentsIndex = filePath.indexOf('/documents/')
      if (documentsIndex !== -1) {
        filePath = filePath.substring(documentsIndex + '/documents/'.length).split('?')[0]
      } else if (filePath.includes('/')) {
        // Last resort: use full path, not just filename
        const parts = filePath.split('/')
        const documentsIdx = parts.findIndex((p: string) => p === 'documents')
        if (documentsIdx !== -1 && documentsIdx < parts.length - 1) {
          filePath = parts.slice(documentsIdx + 1).join('/').split('?')[0]
        } else {
          filePath = filePath.split('/').pop() || filePath
        }
      }
    }
    
    // Get signed URL for the uploaded document using full path
    const { data: signedUrlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 31536000) // 1 year

    const signatureUrl = signedUrlData?.signedUrl || filePath

    // FIXED: Sanitize signedByName to prevent impersonation
    const sanitizedSignedByName = sanitizeString(signedByName, 100)
    if (!sanitizedSignedByName) {
      return NextResponse.json(
        { error: "Invalid signature name" },
        { status: 400 }
      )
    }

    // Update BOL with signature
    // @ts-ignore - updateBOLSignature exists but TypeScript may not recognize it
    const updateResult = await (bolActions as any).updateBOLSignature(bolId, signatureType, {
      signature_url: signatureUrl,
      signed_by: sanitizedSignedByName, // FIXED: Sanitized
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



