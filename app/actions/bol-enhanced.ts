"use server"

/**
 * Enhanced BOL Actions
 * Includes PDF storage and signed BOL management
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { generateBOLPDF } from "./bol-pdf"

/**
 * Store signed BOL PDF in Supabase Storage
 */
export async function storeSignedBOLPDF(bolId: string, companyId?: string): Promise<{
  data: { pdf_url: string } | null
  error: string | null
}> {
  // CRITICAL FIX 4: Use service-role client for storage operations to allow background execution
  let targetCompanyId = companyId
  let supabase = await createClient()

  if (!targetCompanyId) {
    // Try to get company_id from BOL itself first (no auth required)
    const { data: bolData } = await supabase
      .from("bols")
      .select("company_id")
      .eq("id", bolId)
      .single()

    if (bolData?.company_id) {
      targetCompanyId = bolData.company_id
    } else {
      // Fallback: try to get from user session if available
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (!authError && user) {
        const result = await getCachedUserCompany(user.id)
        if (result.company_id) {
          targetCompanyId = result.company_id
        }
      }

      if (!targetCompanyId) {
        return { error: "Cannot determine company for BOL", data: null }
      }
    }
  }

  // Use service-role client for storage operations (bypasses RLS)
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    supabase = createAdminClient()
  } catch (error) {
    // If admin client not available, continue with regular client
    console.warn("[storeSignedBOLPDF] Admin client not available, using regular client")
  }

  try {
    // Get BOL data
    const { data: bol, error: bolError } = await supabase
      .from("bols")
      .select("*")
      .eq("id", bolId)
      .eq("company_id", targetCompanyId)
      .single()

    if (bolError || !bol) {
      return { error: bolError?.message || "BOL not found", data: null }
    }

    // Check if BOL is signed (has consignee signature)
    if (!bol.consignee_signature) {
      return { error: "BOL is not signed. Cannot store PDF until POD is captured.", data: null }
    }

    // Generate PDF HTML
    const pdfResult = await generateBOLPDF(bolId)
    if (pdfResult.error || !pdfResult.html) {
      return { error: pdfResult.error || "Failed to generate PDF", data: null }
    }

    // Convert HTML to PDF using a headless browser or PDF library
    // For now, we'll store the HTML and convert it server-side when needed
    // In production, you'd use puppeteer or similar to convert HTML to PDF

    // CRITICAL FIX 4: Store as HTML for now (real PDF generation requires Puppeteer/Playwright)
    // Note: This is an interim solution. For production, use @react-pdf/renderer or Puppeteer
    const fileName = `bols/${targetCompanyId}/${bol.bol_number}-signed-${Date.now()}.html`
    
    // Convert HTML to blob
    const htmlBlob = new Blob([pdfResult.html], { type: "text/html" })
    const file = new File([htmlBlob], `${bol.bol_number}-signed.html`, { type: "text/html" })
    
    // TODO: CRITICAL FIX 4 - Replace with real PDF generation:
    // 1. Use @react-pdf/renderer on server or Edge Function
    // 2. Or use Puppeteer/Playwright to convert HTML to PDF
    // 3. Store with contentType: 'application/pdf' and .pdf extension
    // 4. Convert embedded signature images to base64 data URIs to prevent expiration

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, {
        contentType: "text/html",
        upsert: false,
      })

    if (uploadError) {
      console.error("Error uploading BOL PDF:", uploadError)
      return { error: uploadError.message, data: null }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName)

    const pdfUrl = urlData.publicUrl

    // Update BOL with PDF URL
    const { error: updateError } = await supabase
      .from("bols")
      .update({
        metadata: {
          ...(bol.metadata || {}),
          signed_pdf_url: pdfUrl,
          signed_pdf_stored_at: new Date().toISOString(),
        },
      })
      .eq("id", bolId)

    if (updateError) {
      console.error("Error updating BOL with PDF URL:", updateError)
      // Don't fail if metadata update fails
    }

    // Also create a document record for audit trail
    try {
      const { createDocument } = await import("./documents")
      await createDocument({
        name: `BOL ${bol.bol_number} - Signed`,
        type: "bol",
        file_url: pdfUrl,
        load_id: bol.load_id,
        metadata: {
          bol_id: bolId,
          bol_number: bol.bol_number,
          stored_at: new Date().toISOString(),
        },
      }).catch(() => {
        // Document creation might fail, that's okay
      })
    } catch (error) {
      console.error("Failed to create document record:", error)
    }

    revalidatePath(`/dashboard/bols/${bolId}`)
    revalidatePath("/dashboard/bols")

    return { data: { pdf_url: pdfUrl }, error: null }
  } catch (error: any) {
    console.error("Unhandled error in storeSignedBOLPDF:", error)
    return { error: error.message || "Failed to store BOL PDF", data: null }
  }
}

/**
 * Auto-store PDF when BOL is completed (all signatures captured)
 */
export async function autoStoreBOLPDFOnCompletion(bolId: string, companyId?: string): Promise<{
  data: { pdf_url: string } | null
  error: string | null
}> {
  // CRITICAL FIX 4: Use service-role client for storage operations to allow background execution
  let targetCompanyId = companyId
  let supabase = await createClient()

  if (!targetCompanyId) {
    // Try to get company_id from BOL itself first (no auth required)
    const { data: bolData } = await supabase
      .from("bols")
      .select("company_id")
      .eq("id", bolId)
      .single()

    if (bolData?.company_id) {
      targetCompanyId = bolData.company_id
    } else {
      // Fallback: try to get from user session if available
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (!authError && user) {
        const result = await getCachedUserCompany(user.id)
        if (result.company_id) {
          targetCompanyId = result.company_id
        }
      }

      if (!targetCompanyId) {
        return { error: "Cannot determine company for BOL", data: null }
      }
    }
  }

  // Use service-role client for storage operations (bypasses RLS)
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    supabase = createAdminClient()
  } catch (error) {
    // If admin client not available, continue with regular client
    console.warn("[autoStoreBOLPDFOnCompletion] Admin client not available, using regular client")
  }

  try {
    // Check if BOL is completed (has consignee signature)
    const { data: bol, error: bolError } = await supabase
      .from("bols")
      .select("id, consignee_signature, metadata")
      .eq("id", bolId)
      .eq("company_id", targetCompanyId)
      .single()

    if (bolError || !bol) {
      return { error: bolError?.message || "BOL not found", data: null }
    }

    // Check if PDF already stored
    if (bol.metadata && (bol.metadata as any).signed_pdf_url) {
      return {
        data: { pdf_url: (bol.metadata as any).signed_pdf_url },
        error: null,
      }
    }

    // Only store if consignee signature exists (POD captured)
    if (bol.consignee_signature) {
      return await storeSignedBOLPDF(bolId, targetCompanyId)
    }

    return { error: "BOL is not completed. POD signature required.", data: null }
  } catch (error: any) {
    console.error("Unhandled error in autoStoreBOLPDFOnCompletion:", error)
    return { error: error.message || "Failed to auto-store BOL PDF", data: null }
  }
}



